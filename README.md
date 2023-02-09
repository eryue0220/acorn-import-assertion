# acorn-import-assertion
## Suport for import assertion in acorn

## Usage

Require this module as an [Acorn](https://github.com/acornjs/acorn) plugin just like the following code:
```javascript
import { Parser } from 'acorn';
import ImportAssertionPlugin from 'acorn-import-assertion-v2';

const MyParser = Parser.extend(ImportAssertionPlugin);

MyParser.parse(/* code */, { /* configuration*/ });
```

## License
This repo is release under an MIT License
