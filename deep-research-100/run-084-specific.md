# Run 084 [specific]
> **Query:** Configuring CockroachDB multi-region cluster with follower reads and stale read latency under 5ms
> **Tokens:** 30,613 (reasoning: 4,984)

## Searches (4)

### Step 1: `CockroachDB follower reads AS OF SYSTEM TIME follower_read_timestamp() closed timestamp target duration setting`
  - CockroachDB follower reads AS OF SYSTEM TIME follower_read_timestamp() closed timestamp target duration setting
  - CockroachDB multi-region database PRIMARY REGION SURVIVE REGIONS syntax
  - CockroachDB default_transaction_use_follower_reads setting
  - CockroachDB kv.closed_timestamp.target_duration follower reads latency staleness

### Step 2: `CockroachDB GLOBAL table locality replicas in all regions follower reads serve locally`
  - CockroachDB GLOBAL table locality replicas in all regions follower reads serve locally
  - CockroachDB REGIONAL BY TABLE table locality home region reads and writes leaseholder location
  - CockroachDB bounded staleness with_max_staleness follower reads single row implicit transaction
  - CockroachDB multi-region survival goal REGION pattern 2-2-1 5 replicas

### Step 3: `CockroachDB follower reads nearest replica requires replica in locality non-voting replicas placement multi-region database default replicas`
  - CockroachDB follower reads nearest replica requires replica in locality non-voting replicas placement multi-region database default replicas
  - CockroachDB global tables non-voting replicas in every region that does not have voting replicas documentation
  - CockroachDB multi-region database replication pattern regional by table replicas in home region voting and non-voting

### Step 4: `CockroachDB ZONE survivability non-voting replicas in each non-home region 3 voting replicas in home region documentation`
  - CockroachDB ZONE survivability non-voting replicas in each non-home region 3 voting replicas in home region documentation
  - CockroachDB PLACEMENT RESTRICTED disables non-voting replicas follower reads
  - CockroachDB SHOW RANGES FROM TABLE follower reads nearest replica gateway forwards closest node contains replica
