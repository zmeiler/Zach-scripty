package rpgserver;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import rpgshared.EntityState;
import rpgshared.Enums;
import rpgshared.Enums.EntityType;
import rpgshared.Enums.ItemType;
import rpgshared.Enums.MessageType;
import rpgshared.Enums.SkillType;
import rpgshared.Inventory;
import rpgshared.NetMessage;
import rpgshared.SkillSet;

public class GameServer {
    private final int port;
    private final World world;
    private final Map<Integer, ServerPlayer> players = new ConcurrentHashMap<>();
    private final Map<UUID, ClientHandler> clients = new ConcurrentHashMap<>();
    private final List<Monster> monsters = Collections.synchronizedList(new ArrayList<>());
    private final List<Npc> npcs = new ArrayList<>();
    private final List<ResourceNode> resources = new ArrayList<>();
    private final Random random = new Random();
    private final AccountStore accountStore;
    private int nextEntityId = 1;
    private volatile boolean running = true;

    public GameServer(int port) throws IOException {
        this.port = port;
        this.world = new World(120, 120);
        this.accountStore = new AccountStore(Path.of("data", "accounts"));
        seedWorld();
    }

    public void start() throws IOException {
        Thread loop = new Thread(this::gameLoop, "server-loop");
        loop.start();
        try (ServerSocket serverSocket = new ServerSocket(port)) {
            while (running) {
                Socket socket = serverSocket.accept();
                ClientHandler handler = new ClientHandler(socket);
                Thread thread = new Thread(handler, "client-handler");
                thread.start();
            }
        }
    }

    public void stop() {
        running = false;
        for (ClientHandler handler : clients.values()) {
            handler.disconnect();
        }
    }

    private void seedWorld() {
        for (int i = 0; i < 12; i++) {
            monsters.add(new Monster(nextEntityId++, "Forest Imp", 30 + i * 3, 30 + (i % 5), 20, 2, 3, 1));
        }
        for (int i = 0; i < 8; i++) {
            monsters.add(new Monster(nextEntityId++, "Rock Beetle", 70 + i * 2, 40 + (i % 4), 28, 3, 4, 2));
        }
        for (int i = 0; i < 6; i++) {
            monsters.add(new Monster(nextEntityId++, "Bog Stalker", 50 + i * 2, 80 + (i % 3), 35, 4, 5, 3));
        }
        npcs.add(new Npc(nextEntityId++, "Greta the Guide", 40, 40, new String[]{
            "Welcome to Oakridge!",
            "Try gathering wood, ore, or fish to train skills.",
            "Visit Joran's shop for supplies."
        }, false));
        npcs.add(new Npc(nextEntityId++, "Joran the Trader", 42, 41, new String[]{
            "Looking to trade?",
            "I buy logs, ore, and fish.",
            "Use the trade option to see prices."
        }, true));
        int id = nextEntityId++;
        resources.add(new ResourceNode(id++, "Oak Tree", 35, 44, ItemType.LOG, SkillType.WOODCUTTING, 10));
        resources.add(new ResourceNode(id++, "Oak Tree", 37, 46, ItemType.LOG, SkillType.WOODCUTTING, 10));
        resources.add(new ResourceNode(id++, "Copper Vein", 65, 52, ItemType.ORE, SkillType.MINING, 12));
        resources.add(new ResourceNode(id++, "Copper Vein", 68, 54, ItemType.ORE, SkillType.MINING, 12));
        resources.add(new ResourceNode(id++, "Fishing Spot", 48, 60, ItemType.FISH, SkillType.FISHING, 8));
        resources.add(new ResourceNode(id++, "Fishing Spot", 52, 61, ItemType.FISH, SkillType.FISHING, 8));
    }

    private void gameLoop() {
        long lastTick = System.currentTimeMillis();
        while (running) {
            long now = System.currentTimeMillis();
            if (now - lastTick >= 200) {
                updateMonsters();
                updatePlayers();
                broadcastState();
                lastTick = now;
            }
            try {
                Thread.sleep(20);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
            }
        }
    }

    private void updateMonsters() {
        for (Monster monster : monsters) {
            if (!monster.isAlive()) {
                if (monster.respawnAt == 0) {
                    monster.respawnAt = System.currentTimeMillis() + 8000;
                } else if (System.currentTimeMillis() >= monster.respawnAt) {
                    monster.hp = monster.maxHp;
                    monster.x = monster.respawnX;
                    monster.y = monster.respawnY;
                    monster.respawnAt = 0;
                }
                continue;
            }
            ServerPlayer target = nearestPlayer(monster.x, monster.y, 5);
            if (target != null && distance(monster.x, monster.y, target.x, target.y) <= 1) {
                attemptAttack(monster, target);
            } else if (target != null) {
                stepToward(monster, target.x, target.y);
            }
        }
    }

    private void updatePlayers() {
        for (ServerPlayer player : players.values()) {
            if (player.hp <= 0) {
                player.hp = player.maxHp;
                player.x = 40;
                player.y = 40;
                sendNotify(player.id, "You wake up back in Oakridge with your wounds mended.");
            }
            int[] destination = world.ladderDestination(player.x, player.y);
            if (destination != null) {
                player.x = destination[0];
                player.y = destination[1];
                sendNotify(player.id, "You climb the ladder.");
            }
        }
    }

    private void attemptAttack(Monster monster, ServerPlayer player) {
        if (System.currentTimeMillis() - monster.lastAttackTime < 1200) {
            return;
        }
        monster.lastAttackTime = System.currentTimeMillis();
        int defense = player.skills.level(SkillType.DEFENSE);
        if (player.equipment.get(rpgshared.Equipment.Slot.ARMOR) != ItemType.NONE) {
            defense += 3;
        }
        int hitChance = 55 + monster.attack * 3 - defense * 2;
        if (random.nextInt(100) < hitChance) {
            int damage = 1 + random.nextInt(monster.strength + 2);
            player.hp = Math.max(0, player.hp - damage);
            player.skills.addXp(SkillType.DEFENSE, 8);
            sendNotify(player.id, monster.name + " hits you for " + damage + "!");
        } else {
            sendNotify(player.id, monster.name + " misses.");
        }
    }

    private ServerPlayer nearestPlayer(int x, int y, int range) {
        ServerPlayer result = null;
        int best = Integer.MAX_VALUE;
        for (ServerPlayer player : players.values()) {
            int dist = distance(x, y, player.x, player.y);
            if (dist < best && dist <= range) {
                best = dist;
                result = player;
            }
        }
        return result;
    }

    private int distance(int x1, int y1, int x2, int y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }

    private void stepToward(Monster monster, int targetX, int targetY) {
        int dx = Integer.compare(targetX, monster.x);
        int dy = Integer.compare(targetY, monster.y);
        int nx = monster.x + dx;
        int ny = monster.y + dy;
        if (world.walkable(nx, ny)) {
            monster.x = nx;
            monster.y = ny;
        }
    }

    private void broadcastState() {
        List<EntityState> states = new ArrayList<>();
        for (ServerPlayer player : players.values()) {
            states.add(new EntityState(player.id, EntityType.PLAYER, player.x, player.y, player.hp, player.maxHp, player.username));
        }
        for (Monster monster : monsters) {
            states.add(new EntityState(monster.id, EntityType.MONSTER, monster.x, monster.y, monster.hp, monster.maxHp, monster.name));
        }
        for (Npc npc : npcs) {
            states.add(new EntityState(npc.id, EntityType.NPC, npc.x, npc.y, 1, 1, npc.name));
        }
        for (ResourceNode node : resources) {
            if (node.isAvailable()) {
                states.add(new EntityState(node.id, EntityType.RESOURCE, node.x, node.y, 1, 1, node.name));
            }
        }
        for (ClientHandler handler : clients.values()) {
            handler.sendState(states, world, resources, npcs);
        }
    }

    private void sendNotify(int playerId, String message) {
        ClientHandler handler = clients.values().stream()
            .filter(h -> h.player != null && h.player.id == playerId)
            .findFirst()
            .orElse(null);
        if (handler != null) {
            handler.sendNotify(message);
        }
    }

    private class ClientHandler implements Runnable {
        private final Socket socket;
        private final DataInputStream in;
        private final DataOutputStream out;
        private volatile boolean connected = true;
        private ServerPlayer player;
        private AccountStore.AccountData accountData;

        ClientHandler(Socket socket) throws IOException {
            this.socket = socket;
            this.in = new DataInputStream(socket.getInputStream());
            this.out = new DataOutputStream(socket.getOutputStream());
        }

        @Override
        public void run() {
            UUID sessionId = UUID.randomUUID();
            clients.put(sessionId, this);
            try {
                while (connected) {
                    MessageType type = NetMessage.readMessageType(in);
                    handleMessage(type);
                }
            } catch (IOException ex) {
                disconnect();
            }
        }

        private void handleMessage(MessageType type) throws IOException {
            switch (type) {
                case LOGIN -> handleLogin();
                case CHAT -> handleChat();
                case MOVE_REQUEST -> handleMove();
                case ATTACK_REQUEST -> handleAttack();
                case INTERACT_REQUEST -> handleInteract();
                case LOGOUT -> disconnect();
                default -> {
                }
            }
        }

        private void handleLogin() throws IOException {
            String username = NetMessage.readString(in);
            String password = NetMessage.readString(in);
            String appearance = NetMessage.readString(in);
            boolean guest = in.readBoolean();
            if (guest) {
                username = "Guest" + (1000 + random.nextInt(9000));
                password = UUID.randomUUID().toString();
            }
            AccountStore.AccountData data;
            if (accountStore.exists(username)) {
                data = accountStore.load(username);
                if (!guest && !accountStore.verifyPassword(data, password)) {
                    sendLoginResult(false, "Invalid password", null);
                    return;
                }
            } else {
                data = accountStore.createAccount(username, password, appearance);
            }
            this.accountData = data;
            ServerPlayer serverPlayer = new ServerPlayer(nextEntityId++, data.username, appearance == null ? data.appearance : appearance);
            serverPlayer.x = data.x;
            serverPlayer.y = data.y;
            serverPlayer.hp = data.hp;
            serverPlayer.skills.levels().putAll(data.skills.levels());
            serverPlayer.skills.xpMap().putAll(data.skills.xpMap());
            for (var stack : data.inventory.items()) {
                serverPlayer.inventory.add(stack.type, stack.amount);
            }
            for (var slot : data.equipment.slots().entrySet()) {
                serverPlayer.equipment.set(slot.getKey(), slot.getValue());
            }
            serverPlayer.sessionId = UUID.randomUUID();
            players.put(serverPlayer.id, serverPlayer);
            this.player = serverPlayer;
            sendLoginResult(true, "Welcome to Oakridge", serverPlayer);
        }

        private void handleChat() throws IOException {
            String message = NetMessage.readString(in);
            if (player == null) {
                return;
            }
            if (message.startsWith("/buy")) {
                handleShopBuy(message);
                return;
            }
            if (message.startsWith("/sell")) {
                handleShopSell(message);
                return;
            }
            if (message.startsWith("/equip")) {
                handleEquip(message);
                return;
            }
            if (message.startsWith("/eat")) {
                handleEat(message);
                return;
            }
            broadcastChat(player.username + ": " + message);
        }

        private void broadcastChat(String message) {
            for (ClientHandler handler : clients.values()) {
                handler.sendChat(message);
            }
        }

        private void handleMove() throws IOException {
            if (player == null) {
                return;
            }
            int targetX = in.readInt();
            int targetY = in.readInt();
            List<int[]> path = Pathfinding.findPath(world, player.x, player.y, targetX, targetY, 40);
            if (!path.isEmpty()) {
                int[] next = path.get(0);
                player.x = next[0];
                player.y = next[1];
            }
        }

        private void handleAttack() throws IOException {
            if (player == null) {
                return;
            }
            int targetId = in.readInt();
            Monster target = monsters.stream().filter(m -> m.id == targetId).findFirst().orElse(null);
            if (target == null || !target.isAlive()) {
                return;
            }
            if (distance(player.x, player.y, target.x, target.y) > 1) {
                return;
            }
            if (System.currentTimeMillis() - player.lastAttackTime < 800) {
                return;
            }
            player.lastAttackTime = System.currentTimeMillis();
            int attackLevel = player.skills.level(SkillType.ATTACK);
            int strengthLevel = player.skills.level(SkillType.STRENGTH);
            if (player.equipment.get(rpgshared.Equipment.Slot.WEAPON) != ItemType.NONE) {
                attackLevel += 2;
                strengthLevel += 2;
            }
            int hitChance = 60 + attackLevel * 2 - target.defense * 2;
            if (random.nextInt(100) < hitChance) {
                int damage = 1 + random.nextInt(Math.max(1, strengthLevel / 2 + 3));
                target.hp = Math.max(0, target.hp - damage);
                sendNotify(player.id, "You hit " + target.name + " for " + damage + ".");
                boolean leveled = player.skills.addXp(SkillType.ATTACK, 20);
                player.skills.addXp(SkillType.STRENGTH, 12);
                boolean hpLeveled = player.skills.addXp(SkillType.HITPOINTS, 6);
                if (leveled) {
                    sendNotify(player.id, "Your attack level increased!");
                }
                if (hpLeveled) {
                    player.refreshMaxHp();
                    sendNotify(player.id, "Your hitpoints increased!");
                }
                if (target.hp == 0) {
                    handleMonsterDeath(target, player);
                }
            } else {
                sendNotify(player.id, "You miss " + target.name + ".");
            }
        }

        private void handleMonsterDeath(Monster monster, ServerPlayer player) {
            monster.respawnAt = System.currentTimeMillis() + 8000;
            sendNotify(player.id, monster.name + " collapses.");
            int roll = random.nextInt(100);
            if (roll < 10) {
                player.inventory.add(ItemType.BRONZE_SWORD, 1);
            } else if (roll < 20) {
                player.inventory.add(ItemType.BRONZE_ARMOR, 1);
            } else if (roll < 60) {
                player.inventory.add(ItemType.COIN, 12 + random.nextInt(20));
            } else {
                player.inventory.add(ItemType.BREAD, 1);
            }
            sendPlayerUpdate(player);
        }

        private void handleInteract() throws IOException {
            if (player == null) {
                return;
            }
            int tx = in.readInt();
            int ty = in.readInt();
            ResourceNode node = resources.stream()
                .filter(r -> r.x == tx && r.y == ty && r.isAvailable())
                .findFirst()
                .orElse(null);
            if (node != null) {
                if (distance(player.x, player.y, tx, ty) > 1) {
                    sendNotify(player.id, "You need to move closer.");
                    return;
                }
                node.availableAt = System.currentTimeMillis() + node.respawnSeconds * 1000L;
                player.inventory.add(node.reward, 1);
                boolean leveled = player.skills.addXp(node.skill, 30);
                sendNotify(player.id, "You examine the " + node.name + ".");
                sendNotify(player.id, "You take " + node.reward.name().toLowerCase() + " from the " + node.name + ".");
                if (leveled) {
                    sendNotify(player.id, node.skill.name().toLowerCase() + " level up!");
                }
                sendPlayerUpdate(player);
                return;
            }
            Npc npc = npcs.stream().filter(n -> n.x == tx && n.y == ty).findFirst().orElse(null);
            if (npc != null) {
                sendNotify(player.id, "You talk to " + npc.name + ".");
                sendNotify(player.id, npc.dialogue[random.nextInt(npc.dialogue.length)]);
                if (npc.isShopkeeper) {
                    sendNotify(player.id, "Shop: sells bread (6 coins), buys logs/ore/fish (5 coins). Use /buy bread or /sell log.");
                }
            }
        }

        private void handleShopBuy(String message) {
            if (!isNearShopkeeper()) {
                sendNotify(player.id, "You need to be near the shopkeeper.");
                return;
            }
            String[] parts = message.split("\\s+");
            if (parts.length < 2) {
                sendNotify(player.id, "Usage: /buy bread");
                return;
            }
            String item = parts[1].toLowerCase();
            if ("bread".equals(item)) {
                if (player.inventory.remove(ItemType.COIN, 6)) {
                    player.inventory.add(ItemType.BREAD, 1);
                    sendNotify(player.id, "You buy a loaf of bread.");
                    sendPlayerUpdate(player);
                } else {
                    sendNotify(player.id, "Not enough coins.");
                }
            } else {
                sendNotify(player.id, "The shop only sells bread right now.");
            }
        }

        private void handleShopSell(String message) {
            if (!isNearShopkeeper()) {
                sendNotify(player.id, "You need to be near the shopkeeper.");
                return;
            }
            String[] parts = message.split("\\s+");
            if (parts.length < 2) {
                sendNotify(player.id, "Usage: /sell log|ore|fish");
                return;
            }
            String item = parts[1].toLowerCase();
            ItemType type = switch (item) {
                case "log" -> ItemType.LOG;
                case "ore" -> ItemType.ORE;
                case "fish" -> ItemType.FISH;
                default -> ItemType.NONE;
            };
            if (type == ItemType.NONE) {
                sendNotify(player.id, "I only buy logs, ore, and fish.");
                return;
            }
            if (player.inventory.remove(type, 1)) {
                player.inventory.add(ItemType.COIN, 5);
                sendNotify(player.id, "Sold one " + item + ".");
                sendPlayerUpdate(player);
            } else {
                sendNotify(player.id, "You don't have that item.");
            }
        }

        private void handleEquip(String message) {
            String[] parts = message.split("\\s+");
            if (parts.length < 2) {
                sendNotify(player.id, "Usage: /equip sword|armor");
                return;
            }
            String item = parts[1].toLowerCase();
            if ("sword".equals(item)) {
                if (player.inventory.remove(ItemType.BRONZE_SWORD, 1)) {
                    player.equipment.set(rpgshared.Equipment.Slot.WEAPON, ItemType.BRONZE_SWORD);
                    sendNotify(player.id, "You equip a bronze sword.");
                    sendPlayerUpdate(player);
                } else {
                    sendNotify(player.id, "You need a bronze sword.");
                }
            } else if ("armor".equals(item)) {
                if (player.inventory.remove(ItemType.BRONZE_ARMOR, 1)) {
                    player.equipment.set(rpgshared.Equipment.Slot.ARMOR, ItemType.BRONZE_ARMOR);
                    sendNotify(player.id, "You equip bronze armor.");
                    sendPlayerUpdate(player);
                } else {
                    sendNotify(player.id, "You need bronze armor.");
                }
            } else {
                sendNotify(player.id, "Unknown equipment.");
            }
        }

        private void handleEat(String message) {
            if (player.inventory.remove(ItemType.BREAD, 1)) {
                player.hp = Math.min(player.maxHp, player.hp + 8);
                sendNotify(player.id, "You eat the bread and feel better.");
                sendPlayerUpdate(player);
            } else {
                sendNotify(player.id, "You have no bread.");
            }
        }

        private boolean isNearShopkeeper() {
            return npcs.stream().anyMatch(npc -> npc.isShopkeeper && distance(player.x, player.y, npc.x, npc.y) <= 2);
        }

        private void sendLoginResult(boolean success, String message, ServerPlayer player) throws IOException {
            NetMessage.writeMessageType(out, MessageType.LOGIN_RESULT);
            out.writeBoolean(success);
            NetMessage.writeString(out, message);
            if (success && player != null) {
                out.writeInt(player.id);
                out.writeInt(world.width);
                out.writeInt(world.height);
                NetMessage.writeString(out, world.areaName(player.x, player.y));
                out.writeInt(player.x);
                out.writeInt(player.y);
                out.writeInt(player.hp);
                out.writeInt(player.maxHp);
                NetMessage.writeSkills(out, player.skills);
                NetMessage.writeInventory(out, player.inventory);
                NetMessage.writeEquipment(out, player.equipment);
            }
            out.flush();
        }

        private void sendChat(String message) {
            try {
                NetMessage.writeMessageType(out, MessageType.CHAT);
                NetMessage.writeString(out, message);
                out.flush();
            } catch (IOException ex) {
                disconnect();
            }
        }

        private void sendState(List<EntityState> states, World world, List<ResourceNode> nodes, List<Npc> npcs) {
            try {
                NetMessage.writeMessageType(out, MessageType.STATE_UPDATE);
                out.writeInt(states.size());
                for (EntityState state : states) {
                    out.writeInt(state.id);
                    out.writeInt(state.type.ordinal());
                    out.writeInt(state.x);
                    out.writeInt(state.y);
                    out.writeInt(state.hp);
                    out.writeInt(state.maxHp);
                    NetMessage.writeString(out, state.name);
                }
                out.writeInt(world.width);
                out.writeInt(world.height);
                out.flush();
            } catch (IOException ex) {
                disconnect();
            }
        }

        private void sendPlayerUpdate(ServerPlayer player) {
            try {
                NetMessage.writeMessageType(out, MessageType.PLAYER_UPDATE);
                out.writeInt(player.hp);
                out.writeInt(player.maxHp);
                NetMessage.writeSkills(out, player.skills);
                NetMessage.writeInventory(out, player.inventory);
                NetMessage.writeEquipment(out, player.equipment);
                out.flush();
            } catch (IOException ex) {
                disconnect();
            }
        }

        private void sendNotify(String message) {
            try {
                NetMessage.writeMessageType(out, MessageType.NOTIFY);
                NetMessage.writeString(out, message);
                out.flush();
            } catch (IOException ex) {
                disconnect();
            }
        }

        private void disconnect() {
            connected = false;
            clients.values().remove(this);
            if (player != null) {
                players.remove(player.id);
                try {
                    if (accountData != null) {
                        accountStore.save(player, accountData.passwordHash, accountData.salt);
                    }
                } catch (IOException ex) {
                    System.err.println("Failed to save account: " + ex.getMessage());
                }
            }
            try {
                socket.close();
            } catch (IOException ex) {
                System.err.println("Socket close error: " + ex.getMessage());
            }
        }
    }

    public static void main(String[] args) throws Exception {
        int port = 5555;
        if (args.length > 0) {
            port = Integer.parseInt(args[0]);
        }
        GameServer server = new GameServer(port);
        System.out.println("Oakridge server listening on " + port);
        server.start();
    }
}
