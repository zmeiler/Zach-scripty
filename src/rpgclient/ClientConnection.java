package rpgclient;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.Socket;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import rpgshared.EntityState;
import rpgshared.Enums;
import rpgshared.Enums.EntityType;
import rpgshared.Enums.MessageType;
import rpgshared.NetMessage;
import rpgshared.SkillSet;
import rpgshared.Inventory;
import rpgshared.Equipment;

public class ClientConnection {
    private Socket socket;
    private DataInputStream in;
    private DataOutputStream out;
    private Thread listener;
    private volatile boolean connected;
    private final Map<Integer, EntityState> entities = new ConcurrentHashMap<>();
    private final List<String> chatLog = new ArrayList<>();
    private final List<String> notifyLog = new ArrayList<>();
    private int playerId;
    private int worldWidth;
    private int worldHeight;
    private String areaName = "";
    private int playerX;
    private int playerY;
    private int hp;
    private int maxHp;
    private SkillSet skills = new SkillSet();
    private Inventory inventory = new Inventory(24);
    private Equipment equipment = new Equipment();

    public void connect(String host, int port) throws IOException {
        socket = new Socket(host, port);
        in = new DataInputStream(socket.getInputStream());
        out = new DataOutputStream(socket.getOutputStream());
        connected = true;
        listener = new Thread(this::listen, "client-listener");
        listener.start();
    }

    public void disconnect() {
        connected = false;
        if (socket != null) {
            try {
                socket.close();
            } catch (IOException ex) {
                System.err.println("Client socket close error: " + ex.getMessage());
            }
        }
    }

    private void listen() {
        try {
            while (connected) {
                MessageType type = NetMessage.readMessageType(in);
                handleMessage(type);
            }
        } catch (IOException ex) {
            connected = false;
        }
    }

    private void handleMessage(MessageType type) throws IOException {
        switch (type) {
            case LOGIN_RESULT -> readLoginResult();
            case CHAT -> chatLog.add(NetMessage.readString(in));
            case STATE_UPDATE -> readStateUpdate();
            case PLAYER_UPDATE -> readPlayerUpdate();
            case NOTIFY -> notifyLog.add(NetMessage.readString(in));
            default -> {
            }
        }
    }

    private void readLoginResult() throws IOException {
        boolean success = in.readBoolean();
        String message = NetMessage.readString(in);
        notifyLog.add(message);
        if (!success) {
            connected = false;
            return;
        }
        playerId = in.readInt();
        worldWidth = in.readInt();
        worldHeight = in.readInt();
        areaName = NetMessage.readString(in);
        playerX = in.readInt();
        playerY = in.readInt();
        hp = in.readInt();
        maxHp = in.readInt();
        skills = NetMessage.readSkills(in);
        inventory = NetMessage.readInventory(in);
        equipment = NetMessage.readEquipment(in);
    }

    private void readStateUpdate() throws IOException {
        int count = in.readInt();
        entities.clear();
        for (int i = 0; i < count; i++) {
            int id = in.readInt();
            EntityType type = Enums.EntityType.values()[in.readInt()];
            int x = in.readInt();
            int y = in.readInt();
            int hp = in.readInt();
            int maxHp = in.readInt();
            String name = NetMessage.readString(in);
            entities.put(id, new EntityState(id, type, x, y, hp, maxHp, name));
        }
        EntityState self = entities.get(playerId);
        if (self != null) {
            playerX = self.x;
            playerY = self.y;
        }
        worldWidth = in.readInt();
        worldHeight = in.readInt();
    }

    private void readPlayerUpdate() throws IOException {
        hp = in.readInt();
        maxHp = in.readInt();
        skills = NetMessage.readSkills(in);
        inventory = NetMessage.readInventory(in);
        equipment = NetMessage.readEquipment(in);
    }

    public void sendLogin(String username, String password, String appearance, boolean guest) throws IOException {
        NetMessage.writeMessageType(out, MessageType.LOGIN);
        NetMessage.writeString(out, username);
        NetMessage.writeString(out, password);
        NetMessage.writeString(out, appearance);
        out.writeBoolean(guest);
        out.flush();
    }

    public void sendChat(String message) throws IOException {
        NetMessage.writeMessageType(out, MessageType.CHAT);
        NetMessage.writeString(out, message);
        out.flush();
    }

    public void requestMove(int x, int y) throws IOException {
        NetMessage.writeMessageType(out, MessageType.MOVE_REQUEST);
        out.writeInt(x);
        out.writeInt(y);
        out.flush();
    }

    public void requestAttack(int id) throws IOException {
        NetMessage.writeMessageType(out, MessageType.ATTACK_REQUEST);
        out.writeInt(id);
        out.flush();
    }

    public void requestInteract(int x, int y) throws IOException {
        NetMessage.writeMessageType(out, MessageType.INTERACT_REQUEST);
        out.writeInt(x);
        out.writeInt(y);
        out.flush();
    }

    public Map<Integer, EntityState> entities() {
        return entities;
    }

    public List<String> chatLog() {
        return chatLog;
    }

    public List<String> notifyLog() {
        return notifyLog;
    }

    public int playerId() {
        return playerId;
    }

    public int worldWidth() {
        return worldWidth;
    }

    public int worldHeight() {
        return worldHeight;
    }

    public String areaName() {
        return areaName;
    }

    public int playerX() {
        return playerX;
    }

    public int playerY() {
        return playerY;
    }

    public void setPlayerPosition(int x, int y) {
        this.playerX = x;
        this.playerY = y;
    }

    public int hp() {
        return hp;
    }

    public int maxHp() {
        return maxHp;
    }

    public SkillSet skills() {
        return skills;
    }

    public Inventory inventory() {
        return inventory;
    }

    public Equipment equipment() {
        return equipment;
    }
}
