.PHONY: check

check:
	python3 scripts/validate.py
	shasum -a 256 -c MANIFEST.sha256
