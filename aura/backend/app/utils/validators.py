from app.core.exceptions import AuraError


def ensure_non_empty(value: str, field_name: str) -> None:
    if not value or not value.strip():
        raise AuraError("validation_error", f"O campo '{field_name}' é obrigatório.", status_code=400)

