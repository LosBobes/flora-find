# Shorthand for the Hetzner deploy. Mirrors gamgee's and iris's Makefiles.
#
# Set HETZNER_HOST / HETZNER_USER in your shell profile (same names as the
# GitHub Actions secrets) or pass them on the command line:
#   export HETZNER_HOST=1.2.3.4   HETZNER_USER=root
#   make ssh HETZNER_HOST=1.2.3.4 HETZNER_USER=root
HETZNER_USER ?= root
HOST         ?= $(HETZNER_USER)@$(HETZNER_HOST)
DEPLOY_PATH  ?= /opt/flora-find

.PHONY: ssh logs deploy db-tunnel

# SSH into the server.
ssh:
	ssh $(HOST)

# Tail the running container logs.
logs:
	ssh $(HOST) "cd $(DEPLOY_PATH) && docker compose -f docker-compose.prod.yml logs -f"

# Manual deploy (the GitHub Action does this automatically on push to main).
deploy:
	ssh $(HOST) "cd $(DEPLOY_PATH) && git fetch origin main && git reset --hard origin/main && docker compose -f docker-compose.prod.yml up --build -d --remove-orphans && docker image prune -f"

# Forwards the production Postgres to localhost:5434.
# Connect with: psql postgresql://flora:PASSWORD@localhost:5434/flora
db-tunnel:
	@echo "DB tunnel open at localhost:5434  (Ctrl-C to stop)"
	ssh -L 5434:localhost:5434 -N $(HOST)
