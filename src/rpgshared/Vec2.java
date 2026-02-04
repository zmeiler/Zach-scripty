package rpgshared;

public record Vec2(int x, int y) {
    public Vec2 add(int dx, int dy) {
        return new Vec2(x + dx, y + dy);
    }
}
