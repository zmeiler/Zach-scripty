package rpgshared;

import java.util.EnumMap;
import rpgshared.Enums.SkillType;

public class SkillSet {
    private final EnumMap<SkillType, Integer> levels = new EnumMap<>(SkillType.class);
    private final EnumMap<SkillType, Integer> xp = new EnumMap<>(SkillType.class);

    public SkillSet() {
        for (SkillType type : SkillType.values()) {
            levels.put(type, 1);
            xp.put(type, 0);
        }
        levels.put(SkillType.HITPOINTS, 10);
    }

    public int level(SkillType type) {
        return levels.get(type);
    }

    public int xp(SkillType type) {
        return xp.get(type);
    }

    public boolean addXp(SkillType type, int amount) {
        int currentXp = xp.get(type) + amount;
        xp.put(type, currentXp);
        int level = levels.get(type);
        int nextLevelXp = level * level * 50;
        if (currentXp >= nextLevelXp) {
            levels.put(type, level + 1);
            return true;
        }
        return false;
    }

    public EnumMap<SkillType, Integer> levels() {
        return levels;
    }

    public EnumMap<SkillType, Integer> xpMap() {
        return xp;
    }
}
