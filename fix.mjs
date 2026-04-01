import fs from 'fs';
const file = 'electron/main.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/import \{ spawn, ChildProcess \} from 'child_process';/g, "import { spawn, exec, execSync, ChildProcess } from 'child_process';");
content = content.replace(/[ \t]*const \{ execSync \} = require\('child_process'\);\r?\n/g, "");
content = content.replace(/[ \t]*const \{ exec \} = require\('child_process'\);\r?\n/g, "");

content = content.replace(/const playwrightCore = require\('playwright-core'\);/g, "const playwrightCore = await import('playwright-core');");

content = content.replace(/catch \(\_\) \{\}/g, "catch (_) { Object(_); }");
content = content.replace(/catch \(err\) \{\}/g, "catch (err) { Object(err); }");
content = content.replace(/catch \(e\) \{\}/g, "catch (e) { Object(e); }");
content = content.replace(/catch \(error\) \{\}/g, "catch (error) { Object(error); }");
content = content.replace(/catch \(err: any\) \{\}/g, "catch (err: any) { Object(err); }");

content = content.replace(/\[\\\\\\\/\]/g, "[\\\\/]");

fs.writeFileSync(file, content);
console.log('Fixed main.ts');
