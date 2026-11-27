# Ebb Shareable Presets for Renovate

This directory contains shareable presets that expose Ebb software lifecycle and deprecation data to [Renovate](https://docs.renovatebot.com/).

## Available Presets

### `github>velella-sh/ebb//renovate/eol`

Exposes lifecycle data for major runtime environments and common container base images via a static Renovate custom datasource.

#### Usage

Add the preset to your repository's `renovate.json`:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    "github>velella-sh/ebb//renovate/eol"
  ]
}
```

#### What It Does

1. **Configures custom datasource `ebb`**: Queries Ebb's public static feeds at `https://velella.sh/ebb/api/v1/renovate/{{packageName}}.json`.
2. **Overrides datasources and packages**: Maps runtime and container dependency managers (`nvm`, `nodenv`, `pyenv`, `docker`) to canonical Ebb release line feeds (`generic/nodejs`, `generic/python`, `generic/golang`, etc.).
3. **Marks deprecations**: Release lines past their end-of-life dates carry `isDeprecated: true`. Renovate automatically recognizes deprecated lines, avoids proposing them, and generates update branches or deprecation warnings.
4. **Preserves standard update behavior**: Does not alter Renovate's pull request scheduling, automerge settings, or semantic commit configurations.
