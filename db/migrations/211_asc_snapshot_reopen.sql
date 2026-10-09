UPDATE asc_report_requests r
SET completed_at = NULL
WHERE r.access_type = 'ONE_TIME_SNAPSHOT'
  AND r.completed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM asc_report_instances_seen s
    WHERE s.workspace_id = r.workspace_id AND s.request_id = r.request_id
  );
