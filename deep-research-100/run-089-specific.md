# Run 089 [specific]
> **Query:** How to set up Vitess for horizontal sharding of MySQL with VReplication and MoveTables for zero-downtime migrations
> **Tokens:** 46,494 (reasoning: 3,893)

## Searches (6)

### Step 1: `Vitess MoveTables VReplication zero downtime migration SwitchTraffic Complete workflow vtctldclient`
  - Vitess MoveTables VReplication zero downtime migration SwitchTraffic Complete workflow vtctldclient
  - Vitess documentation MoveTables vtctldclient SwitchReads SwitchWrites
  - Vitess VReplication requirements binlog_format ROW binlog_row_image FULL
  - vtctldclient MoveTables command reference --source_keyspace --target_keyspace --tables --workflow

### Step 2: `vitess horizontal sharding guide create sharded keyspace vtctldclient CreateKeyspace CreateShard`
  - vitess horizontal sharding guide create sharded keyspace vtctldclient CreateKeyspace CreateShard
  - vitess vschema vindex hash create vschema sharded keyspace example
  - vtctldclient ApplyVSchema CreateKeyspace sharded vschema
  - Vitess Reshard workflow VReplication switchtraffic

### Step 3: `vtctldclient CreateKeyspace --sharded CreateShard list keyspaces vitess`
  - vtctldclient CreateKeyspace --sharded CreateShard list keyspaces vitess
  - vtctldclient command CreateKeyspace CreateShard InitShardPrimary
  - Vitess docs CreateKeyspace sharded keyspace --base-keyspace --snapshot
  - vtctldclient ApplySchema ApplyVSchema example

### Step 4: `vitess vtctldclient ApplySchema ApplyVSchema examples`
  - vitess vtctldclient ApplySchema ApplyVSchema examples
  - vtctldclient ApplyVSchema --vschema-file example sharded keyspace
  - vtctldclient ApplySchema --sql-file keyspace
  - Vitess VDiff command vtctldclient

### Step 5: `vtctldclient ApplySchema ddl-strategy vitess sql-file reference`
  - vtctldclient ApplySchema ddl-strategy vitess sql-file reference
  - vitess ApplySchema vtctldclient reference programs
  - vitess schema changes ApplySchema --sql-file keyspace shard
  - vtctldclient ApplySchema synopsis

### Step 6: `Vitess MoveTables external MySQL adopt Vitess vttablet external keyspace`
  - Vitess MoveTables external MySQL adopt Vitess vttablet external keyspace
  - Vitess user guide adopting Vitess MoveTables external database workflow
  - vitess external mysql to vitess MoveTables create --source-keyspace external
  - vitess vttablet externalmysql flag
