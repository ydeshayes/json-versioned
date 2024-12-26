# JSON Versioning Library

A TypeScript library for managing JSON data versioning and migrations with a clean, declarative API. Supports both decorator and functional approaches.

## Installation 
```bash
npm install json-versioned
```

## Features

- ✨ Version your data structures with ease
- 🔄 Automatic data migrations
- 🎨 Decorator and functional programming styles
- 🔒 Type-safe migrations
- 📦 Zero dependencies

## Usage

### Decorator Approach

Use decorators to define your versioned class with migrations:

```typescript
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
@Versioned<UserV3>(3) // Current version is 3 and the current interface is UserV3
@Migration(2, (data: UserV1): UserV2 => {
    const [firstName, lastName] = data.name.split(' ');
    return { firstName, lastName, age: data.age };
})
@Migration(3, (data: UserV2): UserV3 => {
    return {
    ...data,
    email: ${data.firstName.toLowerCase()}.${data.lastName.toLowerCase()}@example.com,
    };
})
class UserManager extends WithVersioning<UserV3>(BaseStorage) {
// Your class implementation
}
// Usage
const manager = new UserManager();
// Serialize
const data = manager.versionedSerialize({
    firstName: 'John',
    lastName: 'Doe',
    age: 30,
    email: 'john.doe@example.com'
});
// Deserialize (with automatic migrations to the latest version)
const oldData = JSON.stringify({
    version: 1,
    data: { name: 'John Doe', age: 30 }
});
const migratedUser = manager.versionedDeserialize(oldData);
// or 
const migratedUser = UserManager.versionedDeserialize(oldData);
```

### Functional Approach

If you prefer not to use decorators, you can use the functional API:
```typescript
const manager = createVersioned<UserV3>(3);
// Define migrations
manager.migrations.toVersion(2).withTransform((data: UserV1): UserV2 => {
    const [firstName, lastName] = data.name.split(' ');
    return {
    firstName,
    lastName,
    age: data.age,
    };
});
manager.migrations.toVersion(3).withTransform((data: UserV2): UserV3 => {
    return {
    ...data,
    email: ${data.firstName.toLowerCase()}.${data.lastName.toLowerCase()}@example.com,
    };
});
// Usage
const serialized = manager.versionedSerialize(currentUser);
const deserialized = manager.versionedDeserialize(oldUserData);
```

## Data Format

The library serializes data in the following format:

``` typescript
{
    version: number;
    data: T;
}
```


## Migration Chain

Migrations are applied sequentially. For example, if you have data in version 1 and want to migrate to version 3:

1. First, the v1 → v2 migration is applied
2. Then, the v2 → v3 migration is applied

## Type Safety

The library is fully typed and will ensure that:
- Migration functions receive the correct input type
- Migration functions return the correct output type
- The final version matches your current schema

## Error Handling

The library will throw errors in the following cases:
- Missing migration for a version
- Invalid version number
- Invalid data format

## Best Practices

1. Always define migrations for each version change
2. Keep migrations pure and deterministic
3. Version your interfaces/types
4. Test your migrations thoroughly

## License

MIT