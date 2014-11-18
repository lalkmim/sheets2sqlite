var db = null;
var sql = window.SQL;

console.log('teste');

$(document).ready(function() {
    db = new sql.Database();
    
    var process = new Sheets2sqlite(db, '1jY9BZne07LoR1nvJm-PLsmQPY6jIKkkdYtuwcjMlQwA', ['department', 'employee']);
    process.start(function() {
        for(var i=0; i<this.tables.length; i++) {
            var table = this.tables[i];
            $('div#sql').append(table.createSQL() + '<br /><br />');
        }
        
        for(var i=0; i<this.tables.length; i++) {
            var table = this.tables[i];
            $('div#sql').append(table.insertSQL() + '<br /><br />');
        }
        
        var sql = 'SELECT * FROM department d, employee e WHERE d.id = e.id_department ORDER BY d.name ASC, e.name ASC';
        var result = db.exec(sql);
        
        var el = tableCreate()(result[0].columns, result[0].values);
        
        $('div#sql').append(sql + '<br /><br />');
        $('div#sql')[0].appendChild(el);
        
        var table = $('div#sql table').DataTable({
    	    paging: false,
    	    ordering: false,
    	    info: false
    	});
    });
});