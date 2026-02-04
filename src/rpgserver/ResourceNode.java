package rpgserver;

import rpgshared.Enums.ItemType;
import rpgshared.Enums.SkillType;

public class ResourceNode {
    public final int id;
    public final String name;
    public final int x;
    public final int y;
    public final ItemType reward;
    public final SkillType skill;
    public final int respawnSeconds;
    public long availableAt;

    public ResourceNode(int id, String name, int x, int y, ItemType reward, SkillType skill, int respawnSeconds) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.reward = reward;
        this.skill = skill;
        this.respawnSeconds = respawnSeconds;
    }

    public boolean isAvailable() {
        return System.currentTimeMillis() >= availableAt;
    }
}
