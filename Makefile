.PHONY: manifest manifest-check check

manifest:
	python3 scripts/manifest.py generate

manifest-check:
	python3 scripts/manifest.py check

check:
	python3 scripts/validate.py
	python3 scripts/manifest.py check
