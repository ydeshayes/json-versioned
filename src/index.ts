export type MigrationFn = (data: any) => any;

type VersionMigrations<T> = Map<number, MigrationFn>;

export interface VersionedData<T> {
  version: number;
  data: T;
}

export interface IMigrationBuilder {
  toVersion(version: number): IMigrationTransformStep;
}

interface IMigrationTransformStep {
  withTransform(fn: MigrationFn): void;
}

export interface IVersioned<T> {
  versionedSerialize(data: T): string;
  versionedDeserialize(json: string): T;
  setCurrentVersion(version: number): void;
  migrations: IMigrationBuilder;
  addMigration: (fromVersion: number, migrationFn: MigrationFn) => void;
}

interface MigrationMetadata {
  toVersion: number;
  transform: MigrationFn;
}

const migrationMetadataMap = new WeakMap<any, MigrationMetadata[]>();

// Add the Migration decorator
export function Migration(toVersion: number, transform: MigrationFn) {
  return function (target: any) {
    const existingMigrations = migrationMetadataMap.get(target) || [];
    migrationMetadataMap.set(target, [
      ...existingMigrations,
      { toVersion, transform },
    ]);
  };
}

// Create a function that returns the versioned functionality
export function createVersioned<T>(version: number, target?: any) {
  const _migrations: VersionMigrations<T> = new Map();
  let _version: number = version || 1;

  if (target) {
    const existingMigrations = migrationMetadataMap.get(target) || [];
    existingMigrations.forEach(({ toVersion, transform }) => {
      _migrations.set(toVersion - 1, transform);
    });
  }

  const versionedMethods: IVersioned<T> = {
    migrations: {
      toVersion: (to: number) => ({
        withTransform: (fn: MigrationFn) => {
          const from = to - 1;
          if (from >= _version || to > _version || from < 1 || to < 1) {
            throw new Error(
              `Invalid migration: ${from}->${to} must be less than current version ${_version}`,
            );
          }
          _migrations.set(from, fn);
        },
      }),
    },

    addMigration(toVersion: number, migrationFn: MigrationFn) {
      this.migrations.toVersion(toVersion).withTransform(migrationFn);
    },

    setCurrentVersion(version: number): void {
      _version = version;
    },

    versionedSerialize(data: T): string {
      const versionedData: VersionedData<T> = {
        version: _version,
        data: data,
      };
      return JSON.stringify(versionedData);
    },

    versionedDeserialize(json: string): T {
      const parsed: VersionedData<T> = JSON.parse(json);
      console.log("parsed", parsed);
      console.log("_version", _version);
      if (parsed.version > _version) {
        throw new Error(
          `Cannot deserialize data from version ${parsed.version} with current version ${_version}`,
        );
      }

      if (parsed.version === _version) {
        return parsed.data;
      }

      return _applyMigrations(parsed.data, parsed.version);
    },
  };

  function _applyMigrations(data: any, toVersion: number): T {
    let currentData = data;

    for (let version = toVersion; version < _version; version++) {
      const migration = _migrations.get(version);
      if (!migration) {
        throw new Error(`Missing migration for version ${version}`);
      }
      currentData = migration(currentData);
    }

    return currentData;
  }

  return versionedMethods;
}

export function Versioned<T>(version: number) {
  return function <TClass extends { new (...args: any[]): any }>(
    target: TClass,
  ): TClass & {
    new (...args: any[]): IVersioned<T>;
    versionedDeserialize: (json: string) => T;
  } {
    return class extends target {
      private _versionedInstance = createVersioned<T>(version, target);

      static versionedDeserialize = createVersioned<T>(version, target)
        .versionedDeserialize;

      constructor(...args: any[]) {
        super(...args);
        // Apply migrations from decorator
        const migrations = migrationMetadataMap.get(target) || [];
        migrations.forEach(({ toVersion, transform }) => {
          this._versionedInstance.migrations
            .toVersion(toVersion)
            .withTransform(transform);
        });
      }

      get migrations() {
        return this._versionedInstance.migrations;
      }
      setCurrentVersion(version: number) {
        return this._versionedInstance.setCurrentVersion(version);
      }
      versionedSerialize(data: T) {
        return this._versionedInstance.versionedSerialize(data);
      }
      versionedDeserialize(json: string) {
        return this._versionedInstance.versionedDeserialize(json);
      }
      addMigration = (fromVersion: number, migrationFn: MigrationFn) => {
        this._versionedInstance.addMigration(fromVersion, migrationFn);
      };
    };
  };
}

type Constructor<T = {}> = new (...args: any[]) => T;
export function WithVersioning<T, TBase extends Constructor = Constructor>(
  Base: TBase = Object as any,
) {
  return class extends Base implements IVersioned<T> {
    static versionedDeserialize: (json: string) => T;

    migrations!: IMigrationBuilder;
    versionedSerialize!: (data: T) => string;
    versionedDeserialize!: (json: string) => T;
    setCurrentVersion!: (version: number) => void;
    addMigration!: (fromVersion: number, migrationFn: MigrationFn) => void;
  };
}
