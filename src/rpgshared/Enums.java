package rpgshared;

public final class Enums {
    private Enums() {}

    public enum TileType {
        GRASS(true, 0x3f9b3f),
        DIRT(true, 0x8b5a2b),
        WATER(false, 0x2f5fd1),
        STONE(true, 0x7f7f7f),
        SAND(true, 0xd8c36a),
        WOOD_FLOOR(true, 0x9b6b3f),
        LAVA(false, 0xd13f2f),
        BRIDGE(true, 0x9b7b4f),
        ROAD(true, 0x6b4b2f),
        WALL(false, 0x3f3f3f),
        DOOR(true, 0x6b3f1f),
        LADDER(true, 0x8f8f5f);

        public final boolean walkable;
        public final int color;

        TileType(boolean walkable, int color) {
            this.walkable = walkable;
            this.color = color;
        }
    }

    public enum ItemType {
        NONE,
        BRONZE_SWORD,
        BRONZE_AXE,
        BRONZE_PICKAXE,
        BRONZE_ARMOR,
        LOG,
        ORE,
        FISH,
        BREAD,
        COIN
    }

    public enum SkillType {
        ATTACK,
        STRENGTH,
        DEFENSE,
        HITPOINTS,
        MINING,
        WOODCUTTING,
        FISHING
    }

    public enum EntityType {
        PLAYER,
        MONSTER,
        NPC,
        RESOURCE
    }

    public enum MessageType {
        LOGIN,
        LOGIN_RESULT,
        CHAT,
        MOVE_REQUEST,
        ATTACK_REQUEST,
        INTERACT_REQUEST,
        STATE_UPDATE,
        PLAYER_UPDATE,
        NOTIFY,
        LOGOUT
    }
}
