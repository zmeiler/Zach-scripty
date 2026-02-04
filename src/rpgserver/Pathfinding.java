package rpgserver;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

public final class Pathfinding {
    private Pathfinding() {}

    public static List<int[]> findPath(World world, int startX, int startY, int goalX, int goalY, int maxSteps) {
        if (!world.walkable(goalX, goalY)) {
            return List.of();
        }
        record Node(int x, int y, int cost, int estimate, Node parent) {}
        PriorityQueue<Node> open = new PriorityQueue<>(Comparator.comparingInt(n -> n.cost + n.estimate));
        Map<String, Integer> best = new HashMap<>();
        Node start = new Node(startX, startY, 0, heuristic(startX, startY, goalX, goalY), null);
        open.add(start);
        best.put(key(startX, startY), 0);
        Node found = null;
        while (!open.isEmpty()) {
            Node current = open.poll();
            if (current.x == goalX && current.y == goalY) {
                found = current;
                break;
            }
            if (current.cost >= maxSteps) {
                continue;
            }
            for (int[] next : world.neighbors(current.x, current.y)) {
                int nx = next[0];
                int ny = next[1];
                int newCost = current.cost + 1;
                String key = key(nx, ny);
                int bestCost = best.getOrDefault(key, Integer.MAX_VALUE);
                if (newCost < bestCost) {
                    best.put(key, newCost);
                    open.add(new Node(nx, ny, newCost, heuristic(nx, ny, goalX, goalY), current));
                }
            }
        }
        if (found == null) {
            return List.of();
        }
        List<int[]> path = new ArrayList<>();
        Node current = found;
        while (current.parent != null) {
            path.add(0, new int[]{current.x, current.y});
            current = current.parent;
        }
        return path;
    }

    private static int heuristic(int x, int y, int gx, int gy) {
        return Math.abs(x - gx) + Math.abs(y - gy);
    }

    private static String key(int x, int y) {
        return x + ":" + y;
    }
}
