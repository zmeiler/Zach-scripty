package rpgshared;

import java.util.EnumMap;
import rpgshared.Enums.ItemType;

public class Equipment {
    public enum Slot {
        WEAPON,
        ARMOR
    }

    private final EnumMap<Slot, ItemType> slots = new EnumMap<>(Slot.class);

    public Equipment() {
        for (Slot slot : Slot.values()) {
            slots.put(slot, ItemType.NONE);
        }
    }

    public ItemType get(Slot slot) {
        return slots.get(slot);
    }

    public void set(Slot slot, ItemType item) {
        slots.put(slot, item);
    }

    public EnumMap<Slot, ItemType> slots() {
        return slots;
    }
}
