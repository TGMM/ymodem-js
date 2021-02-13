# {{.AppName}}

{{.Description}}

Owned by {{.TeamName}}

## Developing

- Update package.json with your library name (`@clever/<name>` if private)

- `npm install`

- Write the library in the `lib/` folder

- Write tests in files suffixed with `.test.ts[x]`

### TypeScript Target

We default the TypeScript compilation target to ES5 for compatibility with older browsers (IE, older versions of Safari).

If your library is intended for use in server code rather than client code, feel free to increase the target in the tsconfig.json. Using a higher target can increase compilation speed and decrease compiled code size.

Independent of the target that you specify, you can still use the latest JavaScript features in your source code, as we specify the latest JavaScript in the tsconfig.json lib setting.

## Testing

```
make test
```

## Building for local use

```
# This will compile lib/ to JavaScript in the dist/ folder
make build
```
