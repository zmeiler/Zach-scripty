"""A compact but extensible survival game title layer.

Ashenfall models a deterministic, testable progression loop suitable for
prototyping a larger 3D survival game.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import random


class Action(str, Enum):
    FORAGE = "forage"
    REST = "rest"
    CRAFT = "craft"
    HUNT = "hunt"
    SCAVENGE = "scavenge"
    EXPLORE = "explore"
    HEAL = "heal"


class Biome(str, Enum):
    FOREST = "forest"
    RUINS = "ruins"
    TUNDRA = "tundra"
    SWAMP = "swamp"


@dataclass(slots=True)
class PlayerState:
    health: int = 100
    stamina: int = 100
    hunger: int = 0
    warmth: int = 70
    morale: int = 60
    food: int = 2
    wood: int = 0
    scrap: int = 0
    medicine: int = 0
    ammo: int = 0
    shelter_level: int = 0

    def is_alive(self) -> bool:
        return self.health > 0


@dataclass(slots=True)
class WorldState:
    day: int = 1
    storm_risk: float = 0.15
    temperature_c: int = 8
    threat_level: int = 1
    biome: Biome = Biome.FOREST


@dataclass(slots=True)
class SurvivalGame:
    """Deterministic survival game loop suitable as a title prototype."""

    seed: int = 7
    target_days: int = 14
    player: PlayerState = field(default_factory=PlayerState)
    world: WorldState = field(default_factory=WorldState)
    rng: random.Random = field(init=False)
    log: list[str] = field(init=False, default_factory=list)

    def __post_init__(self) -> None:
        self.rng = random.Random(self.seed)

    def choose_best_action(self) -> Action:
        p = self.player
        if p.health < 45 and p.medicine > 0:
            return Action.HEAL
        if p.food <= 0 or p.hunger > 45:
            return Action.FORAGE
        if p.shelter_level < 2 and p.wood >= 2 and p.scrap >= 1:
            return Action.CRAFT
        if p.warmth < 35 and p.wood > 0:
            return Action.CRAFT
        if p.stamina < 35 or p.health < 50:
            return Action.REST
        if self.world.threat_level > 3 and p.ammo > 0:
            return Action.HUNT
        if self.world.day % 4 == 0:
            return Action.EXPLORE
        if self.world.day % 3 == 0:
            return Action.SCAVENGE
        return Action.FORAGE

    def step(self, action: Action) -> None:
        self.log.append(f"Day {self.world.day} [{self.world.biome.value}] action: {action.value}")

        self._resolve_action(action)
        self._consume_resources()
        self._resolve_weather()
        self._resolve_threats()
        self._advance_biome_cycle()
        self._clamp_values()
        self.world.day += 1

    def autoplay(self) -> tuple[bool, str]:
        while self.player.is_alive() and self.world.day <= self.target_days:
            self.step(self.choose_best_action())

        if self.player.is_alive():
            return True, f"Victory: survived {self.target_days} days"
        return False, f"Defeat on day {self.world.day - 1}"

    def _resolve_action(self, action: Action) -> None:
        if action is Action.FORAGE:
            bonus = 1 if self.world.biome is Biome.FOREST else 0
            food_gain = self.rng.randint(1, 3) + bonus
            wood_gain = self.rng.randint(0, 2)
            self.player.food += food_gain
            self.player.wood += wood_gain
            self.player.stamina -= 12
            self.player.morale += 2
            self.log.append(f"Foraged +{food_gain} food, +{wood_gain} wood")

        elif action is Action.REST:
            self.player.stamina += 24
            self.player.health += 6
            self.player.hunger += 8
            self.player.morale += 4
            self.log.append("Restored stamina and recovered")

        elif action is Action.CRAFT:
            if self.player.wood >= 2 and self.player.scrap >= 1:
                self.player.wood -= 2
                self.player.scrap -= 1
                self.player.shelter_level += 1
                self.player.warmth += 10
                self.player.stamina -= 6
                self.log.append("Upgraded shelter frame")
            elif self.player.wood >= 1:
                self.player.wood -= 1
                self.player.warmth += 6
                self.log.append("Built a fire to preserve warmth")
            else:
                self.log.append("Craft failed: insufficient materials")

        elif action is Action.HUNT:
            success_roll = self.rng.random()
            self.player.stamina -= 18
            self.player.ammo = max(0, self.player.ammo - 1)
            if success_roll > 0.35:
                self.player.food += 4
                self.player.medicine += 1
                self.player.morale += 6
                self.log.append("Hunt success +4 food +1 medicine")
            else:
                self.player.health -= 10
                self.player.morale -= 4
                self.log.append("Hunt failed: took damage")

        elif action is Action.SCAVENGE:
            scrap_gain = self.rng.randint(1, 3)
            ammo_gain = self.rng.randint(0, 2)
            self.player.scrap += scrap_gain
            self.player.ammo += ammo_gain
            self.player.stamina -= 14
            self.player.morale += 1
            self.log.append(f"Scavenged +{scrap_gain} scrap, +{ammo_gain} ammo")

        elif action is Action.EXPLORE:
            outcome = self.rng.random()
            self.player.stamina -= 20
            if outcome > 0.7:
                self.player.medicine += 2
                self.player.food += 2
                self.player.morale += 8
                self.log.append("Exploration jackpot: found aid cache")
            elif outcome > 0.35:
                self.player.scrap += 2
                self.player.wood += 1
                self.player.morale += 3
                self.log.append("Exploration success: found useful salvage")
            else:
                self.player.health -= 8
                self.player.morale -= 6
                self.log.append("Exploration ambush: took damage")

        elif action is Action.HEAL:
            if self.player.medicine > 0:
                self.player.medicine -= 1
                self.player.health += 20
                self.player.morale += 3
                self.log.append("Applied medicine")
            else:
                self.log.append("Heal failed: no medicine")

    def _consume_resources(self) -> None:
        if self.player.food > 0:
            self.player.food -= 1
            self.player.hunger = max(0, self.player.hunger - 14)
        else:
            self.player.hunger += 18

        if self.player.hunger >= 60:
            self.player.health -= 8
            self.player.morale -= 4

    def _resolve_weather(self) -> None:
        storm_hit = self.rng.random() < self.world.storm_risk
        biome_temp_bias = {
            Biome.FOREST: 1,
            Biome.RUINS: 0,
            Biome.TUNDRA: -2,
            Biome.SWAMP: -1,
        }[self.world.biome]
        self.world.temperature_c += self.rng.randint(-4, 3) + biome_temp_bias

        if storm_hit:
            damage = max(1, 8 - self.player.shelter_level * 2)
            self.player.warmth -= 16
            self.player.health -= damage
            self.player.morale -= 5
            self.log.append(f"Storm hit: -{damage} health")
        else:
            self.player.warmth -= max(1, 3 - self.player.shelter_level)

        if self.world.temperature_c < -5:
            self.player.warmth -= 8

        if self.player.warmth < 25:
            self.player.health -= 5
            self.player.morale -= 3

    def _resolve_threats(self) -> None:
        if self.world.day % 3 == 0:
            self.world.threat_level += 1
            self.world.storm_risk = min(0.55, self.world.storm_risk + 0.03)

        attack_chance = 0.06 * self.world.threat_level
        if self.rng.random() < attack_chance:
            if self.player.ammo > 0:
                self.player.ammo -= 1
                self.player.morale += 2
                self.log.append("Defended camp with ammo")
            elif self.player.medicine > 0:
                self.player.medicine -= 1
                self.log.append("Infection prevented with medicine")
            else:
                self.player.health -= 9
                self.player.morale -= 6
                self.log.append("Night attack: -9 health")

    def _advance_biome_cycle(self) -> None:
        if self.world.day % 5 == 0:
            next_biomes = [Biome.FOREST, Biome.RUINS, Biome.SWAMP, Biome.TUNDRA]
            idx = next_biomes.index(self.world.biome)
            self.world.biome = next_biomes[(idx + 1) % len(next_biomes)]
            self.log.append(f"Migrated biome to {self.world.biome.value}")

    def _clamp_values(self) -> None:
        self.player.health = max(0, min(100, self.player.health))
        self.player.stamina = max(0, min(100, self.player.stamina))
        self.player.hunger = max(0, min(100, self.player.hunger))
        self.player.warmth = max(0, min(100, self.player.warmth))
        self.player.morale = max(0, min(100, self.player.morale))

    def campaign_report(self) -> str:
        p = self.player
        return (
            f"day={self.world.day - 1}, biome={self.world.biome.value}, health={p.health}, "
            f"stamina={p.stamina}, hunger={p.hunger}, warmth={p.warmth}, morale={p.morale}, "
            f"food={p.food}, wood={p.wood}, scrap={p.scrap}, medicine={p.medicine}, "
            f"ammo={p.ammo}, shelter={p.shelter_level}"
        )


def run_title(seed: int = 7, target_days: int = 14) -> str:
    game = SurvivalGame(seed=seed, target_days=target_days)
    victory, summary = game.autoplay()
    outcome = "VICTORY" if victory else "DEFEAT"
    return f"{outcome}: {summary} | {game.campaign_report()}"
