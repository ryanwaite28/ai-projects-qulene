###############################################################################
# Qulene — Terraform bootstrap (placeholder)
#
# The Terraform state bucket (qulene-{env}-tf-state) and lock table
# (qulene-{env}-tf-locks) are provisioned by `infra/scripts/bootstrap.sh`,
# NOT by Terraform. This is the standard chicken-and-egg pattern for remote
# state: Terraform cannot manage its own backend storage.
#
# Run:
#
#     ./infra/scripts/bootstrap.sh         # production AWS, both envs
#     ./infra/scripts/bootstrap.sh --local # MiniStack
#
# This file exists only so the bootstrap directory is committed to the repo
# and documents the intent. Do not add resources here.
###############################################################################

# No resources. See bootstrap.sh.
