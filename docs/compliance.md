# Dispensary Data Collection Compliance Checklist

Use this checklist before onboarding any new source connector.

## Legal and policy review
- Confirm Terms of Service permit automated access for catalog, pricing, and review metadata.
- Decide robots strategy (`respect` or approved exception) and document justification.
- Confirm data retention requirements and takedown process.

## Operational safeguards
- Configure per-source rate limits and crawl intervals.
- Set retry ceilings and circuit breakers.
- Confirm contact email and user agent are set for crawler requests.

## Data quality and reliability
- Store raw records and normalized records separately.
- Track parser success/failure ratio and replay failed payloads.
- Add source health monitoring for last successful sync.

## Sign-off
- Compliance owner:
- Engineering owner:
- Date approved:
