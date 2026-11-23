/** Deterministic, browser-local SQL *learning subset*. No network/database queries are executed.
 * This is intentionally NOT a general SQL server: unsupported syntax is rejected clearly.
 */
export type SqlValue = string | number;
export type SqlRow = Record<string, SqlValue>;
export type SqlOutcome = { columns: string[]; rows: SqlRow[] };
export type SqlExercise = { id: string; title: string; prompt: string; sample: string; hint: string };
const EMPLOYEES: SqlRow[] = [
 {employee_id:1,first_name:"Aisha",department:"Engineering",salary:85000,city:"Delhi"},
 {employee_id:2,first_name:"Ravi",department:"Sales",salary:54000,city:"Noida"},
 {employee_id:3,first_name:"Mira",department:"Engineering",salary:75000,city:"Pune"},
 {employee_id:4,first_name:"Kabir",department:"HR",salary:50000,city:"Delhi"},
 {employee_id:5,first_name:"Neha",department:"Engineering",salary:95000,city:"Noida"},
 {employee_id:6,first_name:"Zoya",department:"Sales",salary:62000,city:"Mumbai"},
];
export const SQL_COLUMNS = ["employee_id","first_name","department","salary","city"] as const;
export const SQL_ROWS = EMPLOYEES;
export const SQL_EXERCISES: SqlExercise[] = [
 {id:"engineers",title:"Engineering salaries",prompt:"Show first_name and salary for employees in Engineering, sorted by salary from highest to lowest.",sample:"SELECT first_name, salary FROM employees WHERE department = 'Engineering' ORDER BY salary DESC",hint:"Use WHERE department = 'Engineering' and ORDER BY salary DESC."},
 {id:"cities",title:"Delhi or Noida",prompt:"Show first_name and city for employees in Delhi or Noida, sorted by first_name ascending.",sample:"SELECT first_name, city FROM employees WHERE city IN ('Delhi', 'Noida') ORDER BY first_name ASC",hint:"Try WHERE city IN ('Delhi', 'Noida')."},
 {id:"top",title:"Top three earners",prompt:"Show first_name and salary for the three highest-paid employees.",sample:"SELECT first_name, salary FROM employees ORDER BY salary DESC LIMIT 3",hint:"Combine ORDER BY salary DESC and LIMIT 3."},
 {id:"count",title:"High-salary count",prompt:"Count employees earning 60000 or more. Name the result total.",sample:"SELECT COUNT(*) AS total FROM employees WHERE salary >= 60000",hint:"Use COUNT(*) AS total and WHERE salary >= 60000."},
 {id:"groups",title:"Employees by department",prompt:"Show each department and its employee count as total. Sort by total descending then department ascending.",sample:"SELECT department, COUNT(*) AS total FROM employees GROUP BY department ORDER BY total DESC, department ASC",hint:"GROUP BY department then ORDER BY total DESC, department ASC."},
 {id:"distinct",title:"Unique cities",prompt:"List unique cities in alphabetical order.",sample:"SELECT DISTINCT city FROM employees ORDER BY city ASC",hint:"Use DISTINCT with ORDER BY city ASC."},
];
const COLUMN_SET = new Set<string>(SQL_COLUMNS);
const MAX_QUERY_LENGTH = 1800;
const compare = (a: SqlValue,b: SqlValue):number => typeof a === "number" && typeof b === "number" ? a-b : String(a).localeCompare(String(b));
function literal(value:string):SqlValue{
 if(/^\d+$/.test(value))return Number(value);
 if(/^'(?:[^']|'')*'$/.test(value))return value.slice(1,-1).replace(/''/g,"'");
 throw new Error("Use a number or a single-quoted string in WHERE.");
}
function predicate(phrase:string):(row:SqlRow)=>boolean{
 const ins=phrase.match(/^([a-z_][a-z_0-9]*)\s+IN\s*\(([\s\S]+)\)$/i);
 if(ins){
  if(!COLUMN_SET.has(ins[1].toLowerCase()))throw new Error("Unknown column in WHERE.");
  const opts=ins[2].split(/\s*,\s*/).map(value=>literal(value.trim()));
  if(opts.length>20)throw new Error("IN has too many values.");
  return row=>opts.includes(row[ins[1].toLowerCase()]);
 }
 const m=phrase.match(/^([a-z_][a-z_0-9]*)\s*(>=|<=|<>|!=|=|>|<)\s*(\d+|'(?:[^']|'')*')$/i);
 if(!m)throw new Error("Supported WHERE: column =, !=, >=, <=, >, < value, or column IN (...). Use AND to combine.");
 const col=m[1].toLowerCase();if(!COLUMN_SET.has(col))throw new Error("Unknown column in WHERE.");
 const value=literal(m[3]);
 return row=>{const c=compare(row[col],value);return m[2]==="="?c===0:m[2]==="!="||m[2]==="<>"?c!==0:m[2]===">="?c>=0:m[2]==="<="?c<=0:m[2]===">"?c>0:c<0;};
}
type Selector = {key:string;label:string;aggregate?:"count"|"avg"};
function selectors(text:string):{items:Selector[];distinct:boolean}{
 const distinct=/^DISTINCT\s+/i.test(text);const trimmed=distinct?text.replace(/^DISTINCT\s+/i,""):text;
 const pieces=trimmed.split(/\s*,\s*/);if(pieces.length>8)throw new Error("Select at most 8 columns.");
 const items:Selector[]=pieces.map(part=>{
  const aggregate=part.match(/^(COUNT\(\*\)|AVG\(salary\))\s+AS\s+([a-z_][a-z_0-9]*)$/i);
  if(aggregate)return {key:aggregate[1].toUpperCase().startsWith("COUNT")?"*":"salary",label:aggregate[2].toLowerCase(),aggregate:aggregate[1].toUpperCase().startsWith("COUNT")?"count":"avg"};
  const alias=part.match(/^([a-z_][a-z_0-9]*)(?:\s+AS\s+([a-z_][a-z_0-9]*))?$/i);
  if(!alias||!COLUMN_SET.has(alias[1].toLowerCase()))throw new Error("SELECT supports listed table columns, COUNT(*) AS alias and AVG(salary) AS alias.");
  return {key:alias[1].toLowerCase(),label:(alias[2]??alias[1]).toLowerCase()};
 });
 if(new Set(items.map(x=>x.label)).size!==items.length)throw new Error("Column labels must be unique.");
 if(distinct&&items.some(x=>x.aggregate))throw new Error("DISTINCT aggregates are not supported in this exercise.");
 return {items,distinct};
}
export function runGuidedSql(raw:string):SqlOutcome{
 const query=raw.trim().replace(/;$/,"").trim();
 if(!query||query.length>MAX_QUERY_LENGTH)throw new Error("Enter a SELECT query (maximum 1,800 characters).");
 if(/[;]|--|\/\*|\*\//.test(query))throw new Error("Only one read-only SELECT statement is supported.");
 const m=query.match(/^SELECT\s+([\s\S]+?)\s+FROM\s+employees(?:\s+WHERE\s+([\s\S]+?))?(?:\s+GROUP\s+BY\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+([\s\S]+?))?(?:\s+LIMIT\s+(\d+))?$/i);
 if(!m)throw new Error("Supported: SELECT ... FROM employees [WHERE ...] [GROUP BY ...] [ORDER BY ...] [LIMIT n].");
 const {items,distinct}=selectors(m[1]);
 const group=m[3]?.trim().toLowerCase();if(group&&!COLUMN_SET.has(group))throw new Error("GROUP BY must name one table column.");
 const conditions=m[2]?.split(/\s+AND\s+/i).map(predicate)??[];
 const data=EMPLOYEES.filter(row=>conditions.every(fn=>fn(row)));
 const hasAggregate=items.some(x=>!!x.aggregate);
 if(group&&items.some(x=>!x.aggregate&&x.key!==group))throw new Error("Non-aggregated columns must be in GROUP BY.");
 if(hasAggregate&&!group&&items.some(x=>!x.aggregate))throw new Error("Use GROUP BY when selecting columns alongside aggregates.");
 const build=(rows:SqlRow[]):SqlRow=>Object.fromEntries(items.map(item=>[
  item.label,item.aggregate==="count"?rows.length:item.aggregate==="avg"?Math.round(rows.reduce((n,r)=>n+Number(r.salary),0)/rows.length*100)/100:rows[0]?.[item.key]
 ])) as SqlRow;
 let output:SqlRow[];
 if(group){
  const groups=new Map<SqlValue,SqlRow[]>();for(const row of data)groups.set(row[group],[...(groups.get(row[group])??[]),row]);
  output=Array.from(groups.values()).map(build);
 }else if(hasAggregate){output=[build(data)];}else{output=data.map(row=>build([row]));}
 if(distinct){const seen=new Set<string>();output=output.filter(r=>{const key=JSON.stringify(r);if(seen.has(key))return false;seen.add(key);return true;});}
 if(m[4]){
  const orders=m[4].split(/\s*,\s*/).map(p=>{const mm=p.match(/^([a-z_][a-z_0-9]*)(?:\s+(ASC|DESC))?$/i);if(!mm)throw new Error("ORDER BY supports column ASC or DESC.");const label=mm[1].toLowerCase();if(!items.some(i=>i.label===label))throw new Error("ORDER BY must use a selected column or alias.");return {label,desc:mm[2]?.toUpperCase()==="DESC"};});
  output.sort((a,b)=>{for(const o of orders){const c=compare(a[o.label],b[o.label]);if(c)return o.desc?-c:c;}return 0;});
 }
 if(m[5]){const limit=Number(m[5]);if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error("LIMIT must be 1–100.");output=output.slice(0,limit);}
 return {columns:items.map(x=>x.label),rows:output};
}
export function checkGuidedSql(input:string,exerciseId:string):{passed:boolean;result:SqlOutcome;expected:SqlOutcome}{
 const exercise=SQL_EXERCISES.find(x=>x.id===exerciseId);
 if(!exercise)throw new Error("Unknown exercise.");
 const result=runGuidedSql(input),expected=runGuidedSql(exercise.sample);
 return {passed:JSON.stringify(result)===JSON.stringify(expected),result,expected};
}
