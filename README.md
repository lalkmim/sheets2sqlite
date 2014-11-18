sheets2sqlite
=============

JavaScript library that converts google spreadsheets data to a client-side in-memory sqlite database.

Pre-requisites
--------------

- A google spreadsheet published and its correspondent id
- sql.js (https://github.com/kripken/sql.js)

Usage
-----

1) On the spreadsheet:

1.1) First line: the column name

1.2) Second line: column type

1.3) Third line (optional): foreign key like "table(referenced_column)"

2) Include sheets2sqlite.js file after jquery and sql.js

```HTML
<script src="//code.jquery.com/jquery-2.1.1.min.js"></script>
<script src="js/sql.js"></script>
<script src="js/sheets2sqlite.js"></script>
<script src="js/demo.js"></script>
```


- On page load, run the following:

```Javascript
$(document).ready(function() {
    var db = new window.SQL.Database();
    var workbookId = '1jY9BZne07LoR1nvJm-PLsmQPY6jIKkkdYtuwcjMlQwA';
    var tablesToProcess = ['department', 'employee'];
    
    var functionToRun = function() {
        console.log('done!');
    }
    
    var process = new Sheets2sqlite(db, workbookId, tablesToProcess);
    process.start(functionToRun);
});
```

Demo
----

Google Spreadsheet: https://docs.google.com/spreadsheets/d/1jY9BZne07LoR1nvJm-PLsmQPY6jIKkkdYtuwcjMlQwA/pubhtml

Database loaded: https://rawgit.com/lalkmim/sheets2sqlite/master/demo.html