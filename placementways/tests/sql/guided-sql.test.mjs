import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { runGuidedSql, checkGuidedSql, SQL_EXERCISES } from '../../src/lib/sql-guided.ts';

test('reference query for every guided SQL exercise succeeds',()=>{
 for(const item of SQL_EXERCISES){
  const r=checkGuidedSql(item.sample,item.id);
  assert.equal(r.passed,true,item.id);
  assert.ok(r.result.rows.length>0,item.id);
 }
});
test('WHERE, AND, IN and sorting evaluate on fixture rows',()=>{
 const r=runGuidedSql("SELECT first_name, salary FROM employees WHERE department = 'Engineering' AND salary >= 80000 ORDER BY salary DESC");
 assert.deepEqual(r.rows.map(x=>x.first_name),['Neha','Aisha']);
 const q=runGuidedSql("SELECT first_name, city FROM employees WHERE city IN ('Delhi','Noida') ORDER BY first_name ASC");
 assert.equal(q.rows.length,4);
});
test('aggregate, distinct and limits have correct semantics',()=>{
 const c=runGuidedSql('SELECT COUNT(*) AS total FROM employees WHERE salary >= 60000');
 assert.equal(c.rows[0].total,4);
 const d=runGuidedSql('SELECT DISTINCT city FROM employees ORDER BY city ASC');
 assert.equal(d.rows.length,4);
 const l=runGuidedSql('SELECT first_name, salary FROM employees ORDER BY salary DESC LIMIT 3');
 assert.deepEqual(l.rows.map(x=>x.salary),[95000,85000,75000]);
});
test('wrong answer is rejected by result-based grading',()=>{
 const verdict=checkGuidedSql('SELECT first_name, salary FROM employees','engineers');
 assert.equal(verdict.passed,false);
});
test('formatted multiline queries grade like single-line queries',()=>{
 const answer = `SELECT first_name,
   city
 FROM employees
 WHERE city IN (
   'Delhi',
   'Noida'
 )
 ORDER BY first_name ASC;`;
 assert.equal(checkGuidedSql(answer,'cities').passed,true);
});
test('mutations, stacked statements, comments and unsupported joins are rejected',()=>{
 for(const q of [
  'DELETE FROM employees',
  'SELECT first_name FROM employees; DROP TABLE employees',
  'SELECT first_name FROM employees -- comment',
  'SELECT first_name FROM employees JOIN secrets ON true',
  'SELECT password FROM employees',
  'SELECT first_name FROM employees WHERE 1=1 OR 1=1',
  'SELECT first_name FROM employees; SELECT first_name FROM employees',
 ]) assert.throws(()=>runGuidedSql(q),q);
});
test('group by requires correct selected fields',()=>{
 assert.throws(()=>runGuidedSql('SELECT first_name, COUNT(*) AS total FROM employees GROUP BY department'));
 assert.deepEqual(runGuidedSql('SELECT department, COUNT(*) AS total FROM employees GROUP BY department ORDER BY total DESC').rows.map(x=>x.total),[3,2,1]);
});
