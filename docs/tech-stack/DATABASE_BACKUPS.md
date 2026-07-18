# PostgreSQL backup and recovery standard

This runbook defines the minimum backup posture for the History Wall production
database. It complements Neon availability features; it does not assume that a
managed database removes the need for project-owned recovery copies.

## Recovery objectives

Initial targets for the project:

- **Operational recovery point objective (RPO):** no more than 24 hours from
  the independent dump, with a shorter window when Neon point-in-time restore
  is available.
- **Recovery time objective (RTO):** restore a small production database within
  four hours of declaring an incident.

Review these targets before storing data whose loss would have a larger impact.

## Required layers

### 1. Neon recovery history

- Enable the plan's point-in-time restore window for production; target at
  least seven days.
- If the selected Neon plan supports scheduled snapshots, take one daily and
  before a risky production migration or bulk data operation.
- Protect the production branch and restrict who can restore or delete it.
- Treat provider retention and feature limits as configuration to verify, not
  assumptions. Record the active plan and restore window in the team's private
  operations notes.

This layer is intended for fast recovery from an erroneous write, deletion, or
migration. It is not the independent copy.

Official background: [Neon point-in-time restore](https://neon.com/blog/announcing-point-in-time-restore)
and [Neon snapshots](https://neon.com/blog/three-ways-to-use-your-snapshots).

### 2. Independent logical backup

Run a nightly GitHub Actions workflow using PostgreSQL's matching `pg_dump`
major version. Produce a custom-format dump:

```sh
pg_dump --format=custom --no-owner --no-acl --file=history-wall.dump "$DATABASE_URL_BACKUP"
```

Upload the dump and its SHA-256 checksum to a private, encrypted, versioned
S3-compatible bucket outside Neon. The backup job receives a dedicated,
least-privileged database credential through GitHub Actions secrets. It must not
print the connection string or place a dump in the repository or a public build
artifact.

Baseline retention:

| Copy | Retention |
| --- | --- |
| Nightly | 14 days |
| Weekly | 8 weeks |
| Monthly | 12 months |

Apply retention through bucket lifecycle rules where possible. Alert the team
when the workflow fails; a silently failing schedule is not a backup system.

## Restore procedure

Do not overwrite production while investigating. Restore to a new, isolated
database first.

1. Identify the incident time and required recovery point.
2. Preserve evidence: relevant logs, the current database, and the suspect
   application revision.
3. Decide whether Neon point-in-time restore or the independent dump provides
   the correct recovery point.
4. Create an empty isolated recovery database with a compatible PostgreSQL
   version.
5. Download the selected dump, verify its checksum, and restore it with
   `pg_restore --no-owner --no-acl`.
6. Run integrity checks: migration state, expected table counts, critical
   relationships, application smoke tests, and a sample of important records.
7. Have a second team member verify the recovery point and checks before any
   production cutover.
8. Change application connections or perform the approved production restore,
   then monitor errors and key user journeys.
9. Preserve the pre-recovery database until the incident is closed.
10. Document the cause, data-loss window, recovery steps, and preventative
    actions.

## Restore testing

- Perform a restore drill after backup automation is first created.
- Repeat the drill at least quarterly and after material database or backup
  changes.
- Record the date, selected backup, checksum result, duration, PostgreSQL
  versions, integrity checks, and tester.
- Delete drill databases and credentials after the result is recorded.

## Ownership checklist

Before production launch, the team must assign named owners for:

- Neon plan, retention window, and access review
- GitHub Actions backup workflow and failure notifications
- Independent bucket billing, encryption, lifecycle, and access review
- Quarterly restore drill
- Incident recovery decision and second-person verification

Do not put credentials or personal contact details in this public repository.
