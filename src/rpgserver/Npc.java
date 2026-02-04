package rpgserver;

public class Npc {
    public final int id;
    public final String name;
    public final int x;
    public final int y;
    public final String[] dialogue;
    public final boolean isShopkeeper;

    public Npc(int id, String name, int x, int y, String[] dialogue, boolean isShopkeeper) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.dialogue = dialogue;
        this.isShopkeeper = isShopkeeper;
    }
}
