"""Core ECS-inspired architecture for a 3D game engine skeleton."""

from __future__ import annotations

from dataclasses import dataclass, field
from time import perf_counter
from typing import Protocol


class Component:
    """Marker base class for components attached to entities."""


@dataclass(slots=True)
class Transform(Component):
    """3D transform used by most entities."""

    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    rx: float = 0.0
    ry: float = 0.0
    rz: float = 0.0
    sx: float = 1.0
    sy: float = 1.0
    sz: float = 1.0


@dataclass(slots=True)
class Entity:
    """Represents an object in the scene graph and ECS world."""

    name: str
    components: dict[type[Component], Component] = field(default_factory=dict)

    def add_component(self, component: Component) -> None:
        self.components[type(component)] = component

    def get(self, component_type: type[Component]) -> Component | None:
        return self.components.get(component_type)


class System(Protocol):
    """Protocol for frame-based systems."""

    name: str

    def initialize(self, scene: "Scene") -> None:
        ...

    def update(self, scene: "Scene", dt: float) -> None:
        ...


@dataclass(slots=True)
class Scene:
    """Holds entities and systems for a game level or world partition."""

    name: str
    entities: list[Entity] = field(default_factory=list)
    systems: list[System] = field(default_factory=list)

    def add_entity(self, entity: Entity) -> None:
        self.entities.append(entity)

    def add_system(self, system: System) -> None:
        self.systems.append(system)

    def initialize(self) -> None:
        for system in self.systems:
            system.initialize(self)

    def update(self, dt: float) -> None:
        for system in self.systems:
            system.update(self, dt)


@dataclass(slots=True)
class Engine:
    """Main game engine runtime loop."""

    target_fps: int = 60
    active_scene: Scene | None = None
    running: bool = False

    def load_scene(self, scene: Scene) -> None:
        self.active_scene = scene
        scene.initialize()

    def tick(self, dt: float) -> None:
        if self.active_scene is None:
            raise RuntimeError("Cannot tick engine without an active scene")
        self.active_scene.update(dt)

    def run_for_seconds(self, seconds: float) -> int:
        """Run a bounded loop and return number of frames processed.

        This is useful for simulation tests and headless server execution.
        """
        if self.active_scene is None:
            raise RuntimeError("No scene loaded")

        fixed_dt = 1.0 / self.target_fps
        self.running = True
        elapsed = 0.0
        frames = 0
        previous = perf_counter()

        while self.running and elapsed < seconds:
            now = perf_counter()
            real_dt = now - previous
            previous = now

            # In a production engine you'd integrate frame pacing and interpolation.
            self.tick(min(real_dt, fixed_dt))
            elapsed += fixed_dt
            frames += 1

        self.running = False
        return frames

    def stop(self) -> None:
        self.running = False
