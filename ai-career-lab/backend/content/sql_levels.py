"""Trusted reference queries for the database interview levels. Users submit SQL only to sql.js."""
from contextlib import closing
from functools import lru_cache
import sqlite3

from .practice import FIXTURES

# title, task and authored reference SQL. Each task gets a fresh in-memory fixture.
TASKS = {
    "database-fundamentals": (
        ("Count known and missing assignments","Return one row containing total employees, then employees with a nonmissing department ID.","SELECT count(*), count(department_id) FROM employees"),
        ("Reconcile a directory","Return one row per department with its name and employee count, including empty departments, ordered by department ID.","SELECT d.name,count(e.id) FROM departments d LEFT JOIN employees e ON e.department_id=d.id GROUP BY d.id ORDER BY d.id")),
    "sql": (
        ("Build a salary shortlist","Return names earning at least 60, ordered by salary descending then name ascending.","SELECT name FROM employees WHERE salary>=60 ORDER BY salary DESC,name"),
        ("Resolve a tied pay rank","Return names at the second-highest distinct salary, sorted by name. If fewer than two different salaries exist, return no rows.","SELECT name FROM employees WHERE salary=(SELECT max(salary) FROM employees WHERE salary<(SELECT max(salary) FROM employees)) ORDER BY name")),
    "database-engines": (
        ("Write a portable summary","Return department_id and maximum salary for each assigned department in ID order. Use standard aggregate SQL.","SELECT department_id,max(salary) FROM employees WHERE department_id IS NOT NULL GROUP BY department_id ORDER BY department_id"),
        ("Keep unassigned staff visible","Return each employee name and a department label. Use 'Unassigned' for missing departments. Sort by employee ID.","SELECT e.name,coalesce(d.name,'Unassigned') FROM employees e LEFT JOIN departments d ON d.id=e.department_id ORDER BY e.id")),
    "tables": (
        ("Find required columns","Use SQLite metadata to return the names of employees columns explicitly declared NOT NULL, in column order.","SELECT name FROM pragma_table_info('employees') WHERE [notnull]=1 ORDER BY cid"),
        ("Inspect a key relationship","Read SQLite metadata and return the local column, referenced table and target column of every foreign key on employees, in foreign-key ID order.","SELECT [from],[table],[to] FROM pragma_foreign_key_list('employees') ORDER BY id")),
    "crud": (
        ("Update one employee safely","Give employee ID 2 a raise of 7. Return all employee IDs and salaries ordered by ID.","UPDATE employees SET salary=salary+7 WHERE id=2; SELECT id,salary FROM employees ORDER BY id"),
        ("Make a repeatable salary correction","For department 2, raise salaries below 58 to a floor of 58. Apply the correction twice. Return all names and final salaries ordered by ID.","UPDATE employees SET salary=58 WHERE department_id=2 AND salary<58; UPDATE employees SET salary=58 WHERE department_id=2 AND salary<58; SELECT name,salary FROM employees ORDER BY id")),
    "joins": (
        ("Show staffed departments","Return department name and employee name for matched assignments only. Order by department ID and then employee ID.","SELECT d.name,e.name FROM departments d JOIN employees e ON e.department_id=d.id ORDER BY d.id,e.id"),
        ("Audit a left-join filter","Return every department's name and number of employees earning at least 60, including departments with zero qualifying employees. Order by department ID.","SELECT d.name,count(e.id) FROM departments d LEFT JOIN employees e ON e.department_id=d.id AND e.salary>=60 GROUP BY d.id ORDER BY d.id")),
    "subqueries": (
        ("Find department leaders","Return the names of all assigned employees earning their department's highest salary, including ties. Order by employee ID.","SELECT e.name FROM employees e WHERE e.salary=(SELECT max(x.salary) FROM employees x WHERE x.department_id=e.department_id) ORDER BY e.id"),
        ("Find departments with no low salary","Return department names having no employee below 60, including empty departments. Sort by name.","SELECT d.name FROM departments d WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.department_id=d.id AND e.salary<60) ORDER BY d.name")),
    "aggregation": (
        ("Filter team totals","Return department_id and salary sum for assigned departments with at least two employees. Order by department_id.","SELECT department_id,sum(salary) FROM employees WHERE department_id IS NOT NULL GROUP BY department_id HAVING count(*)>=2 ORDER BY department_id"),
        ("Build a complete payroll report","For each department, return its name, the total salaries (use 0 for an empty team), and the count of distinct salary amounts. Order by department ID.","SELECT d.name,coalesce(sum(e.salary),0),count(DISTINCT e.salary) FROM departments d LEFT JOIN employees e ON e.department_id=d.id GROUP BY d.id ORDER BY d.id")),
    "indexes": (
        ("Build a compound lookup index","Create an index named employee_pay_lookup on employees(department_id,salary). Return its indexed column names in index order.","CREATE INDEX employee_pay_lookup ON employees(department_id,salary); SELECT name FROM pragma_index_info('employee_pay_lookup') ORDER BY seqno"),
        ("Build an idempotent partial index","Create a partial index named assigned_pay on salary for rows whose department_id is not NULL. Make repeat creation safe. Return index name, partial flag and first indexed column using SQLite metadata.","CREATE INDEX IF NOT EXISTS assigned_pay ON employees(salary) WHERE department_id IS NOT NULL; SELECT l.name,l.partial,i.name FROM pragma_index_list('employees') l JOIN pragma_index_info('assigned_pay') i ON i.seqno=0 WHERE l.name='assigned_pay'")),
    "transactions": (
        ("Commit a targeted adjustment","In a transaction give assigned staff in department 1 a raise of 3. Commit it and select employee ID and salary in ID order.","BEGIN; UPDATE employees SET salary=salary+3 WHERE department_id=1; COMMIT; SELECT id,salary FROM employees ORDER BY id"),
        ("Undo just a trial raise","In one transaction add 2 to every salary. Start a savepoint, add a further 50, roll back only that trial raise, and commit. Return ID and final salary in ID order.","BEGIN; UPDATE employees SET salary=salary+2; SAVEPOINT trial; UPDATE employees SET salary=salary+50; ROLLBACK TO trial; RELEASE trial; COMMIT; SELECT id,salary FROM employees ORDER BY id")),
    "database-design": (
        ("Detect unassigned directory rows","Return employee ID and name for people without a department reference. Order by ID.","SELECT id,name FROM employees WHERE department_id IS NULL ORDER BY id"),
        ("Check a normalization proposal","A directory would repeat the department label once per assigned employee. For each staffed department return its name and the number of extra label copies beyond the one canonical row, in department ID order.","SELECT d.name,count(e.id)-1 FROM departments d JOIN employees e ON e.department_id=d.id GROUP BY d.id ORDER BY d.id"))
}

@lru_cache
def extra_sql(topic_id):
    result=[]
    for level,(title,prompt,reference) in zip(("Intermediate","Advanced"),TASKS[topic_id]):
        tests=[]
        for setup,label in zip(FIXTURES,("Sample team","Empty directory","Missing assignment and ties")):
            with closing(sqlite3.connect(":memory:")) as db:
                db.executescript(setup)
                statements=reference.split("; ")
                if len(statements)>1:
                    db.executescript("; ".join(statements[:-1])+";")
                rows=[list(r) for r in db.execute(statements[-1])]
            tests.append({"input":setup,"label":label,"expected":rows})
        result.append({"id":topic_id+"-"+level.lower(),"title":title,"difficulty":level,"language":"sql",
                       "prompt":prompt,"hint":"Check the required columns, row order, and behavior on an empty directory.",
                       "starter":"-- Inspect the sample data before writing your query.\nSELECT * FROM employees ORDER BY id;\n",
                       "sampleInput":FIXTURES[0],"setup":FIXTURES[0],"sampleOutput":tests[0]["expected"],"tests":tests})
    return result

