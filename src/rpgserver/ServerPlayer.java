package rpgserver;

import java.util.UUID;
import rpgshared.Enums.ItemType;
import rpgshared.Enums.SkillType;
import rpgshared.Equipment;
import rpgshared.Inventory;
import rpgshared.SkillSet;

public class ServerPlayer {
    public final int id;
    public final String username;
    public int x;
    public int y;
    public int hp;
    public int maxHp;
    public final SkillSet skills;
    public final Inventory inventory;
    public final Equipment equipment;
    public final String appearance;
    public long lastAttackTime;
    public UUID sessionId;

    public ServerPlayer(int id, String username, String appearance) {
        this.id = id;
        this.username = username;
        this.appearance = appearance;
        this.skills = new SkillSet();
        this.inventory = new Inventory(24);
        this.equipment = new Equipment();
        this.maxHp = skills.level(SkillType.HITPOINTS) * 10;
        this.hp = maxHp;
        this.inventory.add(ItemType.COIN, 50);
        this.inventory.add(ItemType.BREAD, 2);
        this.inventory.add(ItemType.BRONZE_AXE, 1);
        this.inventory.add(ItemType.BRONZE_PICKAXE, 1);
    }

    public void refreshMaxHp() {
        this.maxHp = skills.level(SkillType.HITPOINTS) * 10;
        if (hp > maxHp) {
            hp = maxHp;
        }
    }
}
