package rpgshared;

import rpgshared.Enums.EntityType;

public class EntityState {
    public int id;
    public EntityType type;
    public int x;
    public int y;
    public int hp;
    public int maxHp;
    public String name;

    public EntityState(int id, EntityType type, int x, int y, int hp, int maxHp, String name) {
        this.id = id;
        this.type = type;
        this.x = x;
        this.y = y;
        this.hp = hp;
        this.maxHp = maxHp;
        this.name = name;
    }
}
