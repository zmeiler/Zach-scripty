package rpgserver;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import rpgshared.Enums.ItemType;
import rpgshared.Enums.SkillType;
import rpgshared.Equipment;
import rpgshared.Inventory;
import rpgshared.ItemStack;
import rpgshared.SkillSet;

public class AccountStore {
    private final Path root;
    private final SecureRandom random = new SecureRandom();

    public AccountStore(Path root) throws IOException {
        this.root = root;
        Files.createDirectories(root);
    }

    public boolean exists(String username) {
        return Files.exists(pathFor(username));
    }

    public AccountData load(String username) throws IOException {
        Path path = pathFor(username);
        if (!Files.exists(path)) {
            return null;
        }
        String json = Files.readString(path, StandardCharsets.UTF_8);
        String passwordHash = extractString(json, "passwordHash");
        String salt = extractString(json, "salt");
        int x = extractInt(json, "x", 40);
        int y = extractInt(json, "y", 40);
        int hp = extractInt(json, "hp", 50);
        String appearance = extractString(json, "appearance");
        SkillSet skills = new SkillSet();
        for (SkillType type : SkillType.values()) {
            int level = extractNestedInt(json, "skills", type.name(), skills.level(type));
            int xp = extractNestedInt(json, "xp", type.name(), skills.xp(type));
            skills.levels().put(type, level);
            skills.xpMap().put(type, xp);
        }
        Inventory inventory = new Inventory(24);
        List<ItemStack> stacks = extractInventory(json);
        for (ItemStack stack : stacks) {
            inventory.add(stack.type, stack.amount);
        }
        Equipment equipment = new Equipment();
        for (Equipment.Slot slot : Equipment.Slot.values()) {
            String item = extractNestedString(json, "equipment", slot.name(), ItemType.NONE.name());
            equipment.set(slot, ItemType.valueOf(item));
        }
        AccountData data = new AccountData(username, passwordHash, salt);
        data.x = x;
        data.y = y;
        data.hp = hp;
        data.skills = skills;
        data.inventory = inventory;
        data.equipment = equipment;
        data.appearance = appearance;
        return data;
    }

    public void save(ServerPlayer player, String passwordHash, String salt) throws IOException {
        StringBuilder builder = new StringBuilder();
        builder.append("{\n");
        builder.append(jsonField("username", player.username)).append(",\n");
        builder.append(jsonField("passwordHash", passwordHash)).append(",\n");
        builder.append(jsonField("salt", salt)).append(",\n");
        builder.append("\"x\":").append(player.x).append(",\n");
        builder.append("\"y\":").append(player.y).append(",\n");
        builder.append("\"hp\":").append(player.hp).append(",\n");
        builder.append(jsonField("appearance", player.appearance)).append(",\n");
        builder.append("\"skills\":{");
        appendSkillMap(builder, player.skills.levels());
        builder.append("},\n");
        builder.append("\"xp\":{");
        appendSkillMap(builder, player.skills.xpMap());
        builder.append("},\n");
        builder.append("\"inventory\":[");
        List<ItemStack> items = player.inventory.items();
        for (int i = 0; i < items.size(); i++) {
            ItemStack stack = items.get(i);
            builder.append("{\"type\":\"").append(stack.type.name()).append("\",\"amount\":").append(stack.amount).append("}");
            if (i < items.size() - 1) {
                builder.append(",");
            }
        }
        builder.append("],\n");
        builder.append("\"equipment\":{");
        int index = 0;
        for (Equipment.Slot slot : Equipment.Slot.values()) {
            builder.append(jsonField(slot.name(), player.equipment.get(slot).name()));
            if (index < Equipment.Slot.values().length - 1) {
                builder.append(",");
            }
            index++;
        }
        builder.append("}\n");
        builder.append("}\n");
        Files.writeString(pathFor(player.username), builder.toString(), StandardCharsets.UTF_8);
    }

    public AccountData createAccount(String username, String password, String appearance) throws IOException {
        byte[] saltBytes = new byte[16];
        random.nextBytes(saltBytes);
        String salt = java.util.Base64.getEncoder().encodeToString(saltBytes);
        String hash = hashPassword(password, saltBytes);
        AccountData data = new AccountData(username, hash, salt);
        data.appearance = appearance;
        saveNew(data);
        return data;
    }

    private void saveNew(AccountData data) throws IOException {
        ServerPlayer temp = new ServerPlayer(0, data.username, data.appearance == null ? "body:0;hair:0;color:0" : data.appearance);
        save(temp, data.passwordHash, data.salt);
    }

    public boolean verifyPassword(AccountData data, String password) {
        byte[] saltBytes = java.util.Base64.getDecoder().decode(data.salt);
        String hash = hashPassword(password, saltBytes);
        return hash.equals(data.passwordHash);
    }

    private String hashPassword(String password, byte[] salt) {
        try {
            PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, 310000, 256);
            SecretKeyFactory skf = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            byte[] hash = skf.generateSecret(spec).getEncoded();
            return java.util.Base64.getEncoder().encodeToString(hash);
        } catch (Exception ex) {
            throw new IllegalStateException("Password hashing failed", ex);
        }
    }

    private Path pathFor(String username) {
        String safe = username.replaceAll("[^a-zA-Z0-9_-]", "_");
        return root.resolve(safe + ".json");
    }

    private String jsonField(String key, String value) {
        return "\"" + key + "\":\"" + escape(value) + "\"";
    }

    private String escape(String input) {
        return input.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private void appendSkillMap(StringBuilder builder, EnumMap<SkillType, Integer> map) {
        int index = 0;
        for (SkillType type : SkillType.values()) {
            builder.append("\"").append(type.name()).append("\":").append(map.get(type));
            if (index < SkillType.values().length - 1) {
                builder.append(",");
            }
            index++;
        }
    }

    private String extractString(String json, String key) {
        Pattern pattern = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"(.*?)\"");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            return matcher.group(1).replace("\\\"", "\"").replace("\\\\", "\\");
        }
        return "";
    }

    private String extractNestedString(String json, String objectKey, String key, String fallback) {
        Pattern pattern = Pattern.compile("\"" + Pattern.quote(objectKey) + "\"\\s*:\\s*\\{([^}]*)\\}");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            String block = matcher.group(1);
            Pattern inner = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"(.*?)\"");
            Matcher innerMatcher = inner.matcher(block);
            if (innerMatcher.find()) {
                return innerMatcher.group(1);
            }
        }
        return fallback;
    }

    private int extractInt(String json, String key, int fallback) {
        Pattern pattern = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(\\d+)");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            return Integer.parseInt(matcher.group(1));
        }
        return fallback;
    }

    private int extractNestedInt(String json, String objectKey, String key, int fallback) {
        Pattern pattern = Pattern.compile("\"" + Pattern.quote(objectKey) + "\"\\s*:\\s*\\{([^}]*)\\}");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            String block = matcher.group(1);
            Pattern inner = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(\\d+)");
            Matcher innerMatcher = inner.matcher(block);
            if (innerMatcher.find()) {
                return Integer.parseInt(innerMatcher.group(1));
            }
        }
        return fallback;
    }

    private List<ItemStack> extractInventory(String json) {
        List<ItemStack> stacks = new ArrayList<>();
        Pattern invPattern = Pattern.compile("\"inventory\"\\s*:\\s*\\[(.*?)]", Pattern.DOTALL);
        Matcher matcher = invPattern.matcher(json);
        if (matcher.find()) {
            String block = matcher.group(1);
            Pattern itemPattern = Pattern.compile("\\{\\\"type\\\":\\\"(.*?)\\\",\\\"amount\\\":(\\d+)\\}");
            Matcher itemMatcher = itemPattern.matcher(block);
            while (itemMatcher.find()) {
                ItemType type = ItemType.valueOf(itemMatcher.group(1));
                int amount = Integer.parseInt(itemMatcher.group(2));
                stacks.add(new ItemStack(type, amount));
            }
        }
        return stacks;
    }

    public static class AccountData {
        public final String username;
        public final String passwordHash;
        public final String salt;
        public int x = 40;
        public int y = 40;
        public int hp = 50;
        public SkillSet skills = new SkillSet();
        public Inventory inventory = new Inventory(24);
        public Equipment equipment = new Equipment();
        public String appearance = "body:0;hair:0;color:0";

        public AccountData(String username, String passwordHash, String salt) {
            this.username = username;
            this.passwordHash = passwordHash;
            this.salt = salt;
        }
    }
}
