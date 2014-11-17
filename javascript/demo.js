var db = null;
var sql = window.SQL;

console.log('teste');

$(document).ready(function() {
    db = new sql.Database();
    
    var process = new Sheets2sqlite(db, '1jY9BZne07LoR1nvJm-PLsmQPY6jIKkkdYtuwcjMlQwA', ['department', 'employee']);
    process.start();
    
    console.log(db.exec('SELECT * FROM department'));
});