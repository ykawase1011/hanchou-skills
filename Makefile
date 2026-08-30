.PHONY: manifest manifest-check typecheck check

manifest:
	mise exec -- node --experimental-strip-types scripts/manifest.ts generate

manifest-check:
	mise exec -- node --experimental-strip-types scripts/manifest.ts check

typecheck:
	mise exec -- npm run typecheck

check: typecheck
	mise exec -- node --experimental-strip-types scripts/validate.ts
	mise exec -- node --experimental-strip-types scripts/manifest.ts check
