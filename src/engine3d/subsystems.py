"""High-level subsystem placeholders emulating AAA engine domains."""

from __future__ import annotations

from dataclasses import dataclass

from .core import Scene, System, Transform


@dataclass(slots=True)
class RenderSystem(System):
    """Collects renderable entities and simulates frame submission."""

    name: str = "render"
    frames_rendered: int = 0

    def initialize(self, scene: Scene) -> None:
        self.frames_rendered = 0

    def update(self, scene: Scene, dt: float) -> None:
        # Placeholder for culling, batching, shadows, and draw-call submission.
        _visible_entities = [
            entity for entity in scene.entities if entity.get(Transform) is not None
        ]
        self.frames_rendered += 1


@dataclass(slots=True)
class PhysicsSystem(System):
    """Very simple transform integration to emulate physics progression."""

    name: str = "physics"
    gravity: float = -9.81

    def initialize(self, scene: Scene) -> None:
        return None

    def update(self, scene: Scene, dt: float) -> None:
        for entity in scene.entities:
            transform = entity.get(Transform)
            if isinstance(transform, Transform):
                transform.y += self.gravity * dt * 0.1


@dataclass(slots=True)
class AudioSystem(System):
    """Tracks audio update ticks for mix/stream simulation."""

    name: str = "audio"
    ticks: int = 0

    def initialize(self, scene: Scene) -> None:
        self.ticks = 0

    def update(self, scene: Scene, dt: float) -> None:
        self.ticks += 1
