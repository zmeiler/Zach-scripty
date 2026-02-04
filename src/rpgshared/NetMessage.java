package rpgshared;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.util.EnumMap;
import java.util.List;
import rpgshared.Enums.ItemType;
import rpgshared.Enums.MessageType;
import rpgshared.Enums.SkillType;
import rpgshared.Equipment.Slot;

public final class NetMessage {
    private NetMessage() {}

    public static void writeString(DataOutputStream out, String value) throws IOException {
        if (value == null) {
            out.writeInt(-1);
            return;
        }
        byte[] data = value.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        out.writeInt(data.length);
        out.write(data);
    }

    public static String readString(DataInputStream in) throws IOException {
        int length = in.readInt();
        if (length < 0) {
            return null;
        }
        byte[] data = new byte[length];
        in.readFully(data);
        return new String(data, java.nio.charset.StandardCharsets.UTF_8);
    }

    public static void writeMessageType(DataOutputStream out, MessageType type) throws IOException {
        out.writeInt(type.ordinal());
    }

    public static MessageType readMessageType(DataInputStream in) throws IOException {
        int ordinal = in.readInt();
        return MessageType.values()[ordinal];
    }

    public static void writeInventory(DataOutputStream out, Inventory inventory) throws IOException {
        List<ItemStack> items = inventory.items();
        out.writeInt(items.size());
        for (ItemStack stack : items) {
            out.writeInt(stack.type.ordinal());
            out.writeInt(stack.amount);
        }
        out.writeInt(inventory.maxSlots());
    }

    public static Inventory readInventory(DataInputStream in) throws IOException {
        int count = in.readInt();
        int maxSlots;
        List<ItemStack> items = new java.util.ArrayList<>();
        for (int i = 0; i < count; i++) {
            ItemType type = ItemType.values()[in.readInt()];
            int amount = in.readInt();
            items.add(new ItemStack(type, amount));
        }
        maxSlots = in.readInt();
        Inventory inventory = new Inventory(maxSlots);
        for (ItemStack stack : items) {
            inventory.add(stack.type, stack.amount);
        }
        return inventory;
    }

    public static void writeSkills(DataOutputStream out, SkillSet skills) throws IOException {
        EnumMap<SkillType, Integer> levels = skills.levels();
        EnumMap<SkillType, Integer> xp = skills.xpMap();
        out.writeInt(SkillType.values().length);
        for (SkillType type : SkillType.values()) {
            out.writeInt(levels.get(type));
            out.writeInt(xp.get(type));
        }
    }

    public static SkillSet readSkills(DataInputStream in) throws IOException {
        SkillSet skills = new SkillSet();
        int count = in.readInt();
        for (int i = 0; i < count; i++) {
            SkillType type = SkillType.values()[i];
            int level = in.readInt();
            int xp = in.readInt();
            skills.levels().put(type, level);
            skills.xpMap().put(type, xp);
        }
        return skills;
    }

    public static void writeEquipment(DataOutputStream out, Equipment equipment) throws IOException {
        out.writeInt(Slot.values().length);
        for (Slot slot : Slot.values()) {
            out.writeInt(equipment.get(slot).ordinal());
        }
    }

    public static Equipment readEquipment(DataInputStream in) throws IOException {
        Equipment equipment = new Equipment();
        int count = in.readInt();
        for (int i = 0; i < count; i++) {
            Slot slot = Slot.values()[i];
            ItemType type = ItemType.values()[in.readInt()];
            equipment.set(slot, type);
        }
        return equipment;
    }
}
