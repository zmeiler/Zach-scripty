package rpgserver;

public class Monster {
    public final int id;
    public final String name;
    public int x;
    public int y;
    public int hp;
    public int maxHp;
    public int attack;
    public int strength;
    public int defense;
    public long lastAttackTime;
    public final int respawnX;
    public final int respawnY;
    public long respawnAt;

    public Monster(int id, String name, int x, int y, int maxHp, int attack, int strength, int defense) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.attack = attack;
        this.strength = strength;
        this.defense = defense;
        this.respawnX = x;
        this.respawnY = y;
    }

    public boolean isAlive() {
        return hp > 0;
    }
}
