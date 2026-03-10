from app.aura_os.memory.manager import MemoryManager


class DummyMemoryService:
    def __init__(self):
        self.settings = {}

    def get_settings(self):
        return self.settings

    def update_settings(self, updates):
        self.settings.update(updates)
        return self.settings


def test_memory_manager_tracks_short_and_long_term():
    manager = MemoryManager(DummyMemoryService())
    manager.remember_interaction("analisar repo", {"intent": "developer"})
    manager.remember_task("analisar repo", "planned")
    overview = manager.overview()
    assert overview["short_term"]["items"] == 1
    assert overview["long_term"]["tasks"] == 1
