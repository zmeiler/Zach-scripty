package rpgshared;

import java.util.ArrayList;
import java.util.List;
import rpgshared.Enums.ItemType;

public class Inventory {
    private final List<ItemStack> items = new ArrayList<>();
    private final int maxSlots;

    public Inventory(int maxSlots) {
        this.maxSlots = maxSlots;
    }

    public List<ItemStack> items() {
        return items;
    }

    public boolean add(ItemType type, int amount) {
        if (amount <= 0 || type == ItemType.NONE) {
            return false;
        }
        for (ItemStack stack : items) {
            if (stack.type == type) {
                stack.amount += amount;
                return true;
            }
        }
        if (items.size() >= maxSlots) {
            return false;
        }
        items.add(new ItemStack(type, amount));
        return true;
    }

    public boolean remove(ItemType type, int amount) {
        for (int i = 0; i < items.size(); i++) {
            ItemStack stack = items.get(i);
            if (stack.type == type) {
                if (stack.amount < amount) {
                    return false;
                }
                stack.amount -= amount;
                if (stack.amount == 0) {
                    items.remove(i);
                }
                return true;
            }
        }
        return false;
    }

    public int count(ItemType type) {
        for (ItemStack stack : items) {
            if (stack.type == type) {
                return stack.amount;
            }
        }
        return 0;
    }

    public int maxSlots() {
        return maxSlots;
    }
}
