from app.aura_os.voice.pipeline import VoicePipeline


class DummyAuraOS:
    def execute(self, request):
        return type(
            "Result",
            (),
            {
                "model_dump": lambda self=None: {
                    "goal": request.goal,
                    "plan_status": "planned",
                    "started": False,
                }
            },
        )()


def test_voice_pipeline_activates_on_wake_word():
    pipeline = VoicePipeline()
    pipeline.attach_runtime(DummyAuraOS())
    result = pipeline.process_once("Aura abrir o projeto aura_v1", speak=False)
    assert result["activated"] is True
    assert result["goal"].startswith("abrir o projeto")
