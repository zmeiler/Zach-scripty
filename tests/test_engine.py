from engine3d import AudioSystem, Biome, Engine, Entity, PhysicsSystem, RenderSystem, Scene, Transform
from engine3d.game import Action, SurvivalGame, run_title


def build_scene() -> tuple[Scene, Entity, RenderSystem, AudioSystem]:
    scene = Scene("benchmark_scene")
    physics = PhysicsSystem()
    render = RenderSystem()
    audio = AudioSystem()

    scene.add_system(physics)
    scene.add_system(render)
    scene.add_system(audio)

    actor = Entity("actor")
    actor.add_component(Transform(y=20.0))
    scene.add_entity(actor)

    return scene, actor, render, audio


def test_engine_runs_and_updates_systems() -> None:
    scene, actor, render, audio = build_scene()
    engine = Engine(target_fps=60)
    engine.load_scene(scene)

    frames = engine.run_for_seconds(0.2)

    assert frames > 0
    assert render.frames_rendered == frames
    assert audio.ticks == frames

    transform = actor.get(Transform)
    assert isinstance(transform, Transform)
    assert transform.y < 20.0


def test_tick_without_scene_raises() -> None:
    engine = Engine()

    try:
        engine.tick(1 / 60)
    except RuntimeError as exc:
        assert "active scene" in str(exc)
    else:
        raise AssertionError("Expected RuntimeError when ticking without scene")


def test_survival_title_is_deterministic_for_seed() -> None:
    game_a = SurvivalGame(seed=42, target_days=12)
    game_b = SurvivalGame(seed=42, target_days=12)

    result_a = game_a.autoplay()
    result_b = game_b.autoplay()

    assert result_a == result_b
    assert game_a.player.health == game_b.player.health
    assert game_a.player.shelter_level == game_b.player.shelter_level
    assert game_a.campaign_report() == game_b.campaign_report()


def test_survival_actions_progress_state() -> None:
    game = SurvivalGame(seed=3, target_days=7)
    game.step(Action.SCAVENGE)
    game.step(Action.CRAFT)
    game.step(Action.EXPLORE)

    assert game.world.day == 4
    assert game.player.health >= 0
    assert game.player.hunger >= 0
    assert game.player.scrap >= 0


def test_biome_rotation_happens_over_time() -> None:
    game = SurvivalGame(seed=5, target_days=6)
    for _ in range(5):
        game.step(Action.FORAGE)

    assert game.world.biome is not Biome.FOREST


def test_run_title_returns_readable_summary() -> None:
    summary = run_title(seed=1, target_days=5)
    assert "health=" in summary
    assert "shelter=" in summary
    assert "biome=" in summary
    assert ("VICTORY:" in summary) or ("DEFEAT:" in summary)
