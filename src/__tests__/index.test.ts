import {
  Versioned,
  MigrationFn,
  IMigrationBuilder,
  createVersioned,
  Migration,
  WithVersioning,
} from "../index";

interface UserV1 {
  name: string;
  age: number;
}

interface UserV2 {
  firstName: string;
  lastName: string;
  age: number;
}

interface UserV3 {
  firstName: string;
  lastName: string;
  age: number;
  email: string;
}

class BaseStorage {
  validateUser(user: UserV3): boolean {
    return user.age >= 0;
  }
}

// Example using the decorator
@Versioned<UserV3>(3)
@Migration(2, (data: UserV1): UserV2 => {
  const [firstName, lastName] = data.name.split(" ");
  return { firstName, lastName, age: data.age };
})
@Migration(3, (data: UserV2): UserV3 => {
  return {
    ...data,
    email: `${data.firstName.toLowerCase()}.${data.lastName.toLowerCase()}@example.com`,
  };
})
class UserManager extends WithVersioning<UserV3>(BaseStorage) {
  validateUser(user: UserV3): boolean {
    return user.age >= 0;
  }
  migrations!: IMigrationBuilder;
  versionedSerialize!: (data: UserV3) => string;
  versionedDeserialize!: (json: string) => UserV3;
  setCurrentVersion!: (version: number) => void;
  addMigration!: (fromVersion: number, migrationFn: MigrationFn) => void;

  serialize(): string {
    return this.versionedSerialize({
      firstName: "John",
      lastName: "Doe",
      age: 30,
      email: "john.doe@example.com",
    });
  }
}

@Versioned<UserV3>(5)
@Migration(2, (data: UserV1): UserV2 => {
  const [firstName, lastName] = data.name.split(" ");
  return { firstName, lastName, age: data.age };
})
@Migration(3, (data: UserV2): UserV3 => {
  return {
    ...data,
    email: `${data.firstName.toLowerCase()}.${data.lastName.toLowerCase()}@example.com`,
  };
})
@Migration(5, (data: UserV3): UserV3 => {
  return {
    ...data,
    email: `${data.firstName.toLowerCase()}.${data.lastName.toLowerCase()}@example.com`,
  };
})
class UserManagerMissingMigrations extends WithVersioning<UserV3>(
  BaseStorage,
) {}

describe("Versioned Functionality", () => {
  describe("Function Usage", () => {
    it("should handle basic serialization and deserialization", () => {
      const manager = createVersioned<UserV3>(3);
      const user: UserV3 = {
        firstName: "John",
        lastName: "Doe",
        age: 30,
        email: "john.doe@example.com",
      };

      const serialized = manager.versionedSerialize(user);
      const deserialized = manager.versionedDeserialize(serialized);

      expect(deserialized).toEqual(user);
    });

    it("should apply migrations correctly", () => {
      const manager = createVersioned<UserV3>(3);

      // Migration from V1 to V2: split name into firstName and lastName
      manager.migrations.toVersion(2).withTransform((data: UserV1): UserV2 => {
        const [firstName, lastName] = data.name.split(" ");
        return {
          firstName,
          lastName,
          age: data.age,
        };
      });

      // Migration from V2 to V3: add email field
      manager.migrations.toVersion(3).withTransform((data: UserV2): UserV3 => {
        return {
          ...data,
          email: `${data.firstName.toLowerCase()}.${data.lastName.toLowerCase()}@example.com`,
        };
      });

      const oldData = JSON.stringify({
        version: 1,
        data: { name: "John Doe", age: 30 },
      });

      const migrated = manager.versionedDeserialize(oldData);

      expect(migrated).toEqual({
        firstName: "John",
        lastName: "Doe",
        age: 30,
        email: "john.doe@example.com",
      });
    });
  });

  // Keep existing decorator tests in a separate describe block
  describe("Decorator Usage", () => {
    it("should throw error for missing migrations", () => {
      const manager = new UserManagerMissingMigrations();

      const oldData = JSON.stringify({
        version: 1,
        data: { name: "John Doe", age: 30 },
      });

      expect(() => manager.versionedDeserialize(oldData)).toThrow(
        "Missing migration for version 3",
      );
    });

    it("should preserve base class functionality", () => {
      const manager = new UserManager();

      const validUser: UserV3 = {
        firstName: "John",
        lastName: "Doe",
        age: 30,
        email: "john.doe@example.com",
      };
      const invalidUser: UserV3 = {
        firstName: "John",
        lastName: "Doe",
        age: -1,
        email: "john.doe@example.com",
      };

      expect(manager.validateUser(validUser)).toBe(true);
      expect(manager.validateUser(invalidUser)).toBe(false);
    });

    it("should migrate to the correct version calling static method", () => {
      const user = JSON.stringify({
        version: 1,
        data: {
          name: "John Doe",
          age: 30,
        },
      });

      const deserialized = UserManager.versionedDeserialize(user);

      expect(deserialized).toEqual({
        firstName: "John",
        lastName: "Doe",
        age: 30,
        email: "john.doe@example.com",
      });
    });

    it("should migrate to the correct version", () => {
      const manager = new UserManager();
      const user = JSON.stringify({
        version: 1,
        data: {
          name: "John Doe",
          age: 30,
        },
      });

      const deserialized = manager.versionedDeserialize(user);

      expect(deserialized).toEqual({
        firstName: "John",
        lastName: "Doe",
        age: 30,
        email: "john.doe@example.com",
      });
    });

    it("should serialize to the correct version with a custom serialize method", () => {
      const manager = new UserManager();
      const serialized = manager.serialize();
      expect(serialized).toEqual(
        JSON.stringify({
          version: 3,
          data: {
            firstName: "John",
            lastName: "Doe",
            age: 30,
            email: "john.doe@example.com",
          },
        }),
      );
    });
  });
});
