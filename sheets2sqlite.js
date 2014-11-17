var WORKBOOK_ID = '1jY9BZne07LoR1nvJm-PLsmQPY6jIKkkdYtuwcjMlQwA';
var SPREADSHEET_WORKBOOK_URL = 'https://spreadsheets.google.com/feeds/worksheets/' + WORKBOOK_ID + '/public/values?alt=json';
var WORKSHEETS_TO_LOAD = ['department', 'employee'];
var sql = window.SQL;
var db = null;
var tables = [];

var control = {
    reqs: 0,
    reqOk: false,
    resps: 0,
    
    ok: function() {
        return (this.reqOk && (this.reqs == this.resps));
    },
    
    reset: function() {
        this.reqs = 0;
        this.resps = 0;
        this.reqOk = false;
    }
};

$(document).ready(function() {
    db = new sql.Database();
    
    $.ajax({
        url: SPREADSHEET_WORKBOOK_URL
    }).done(function(workbookData) {
        for(var i=0; i<workbookData.feed.entry.length; i++) {
            var entry = workbookData.feed.entry[i];
            var item = { name : entry.title.$t, link : entry.link[1].href + '?alt=json' };
            console.log('item:', item);
            control.reqs++;
            (function(name, link) {
                $.ajax({
                    url: link
                }).done(function(worksheetData) {
                    processWorksheetData(name, worksheetData);
                });
            }) (item.name, item.link);
        }
        control.reqOk = true;
    });
});

var processWorksheetData = function(tableName, worksheetData) {
    control.resps++;
    if($.inArray(tableName, WORKSHEETS_TO_LOAD) >= 0) {
        var table = createTable(tableName, worksheetData);
        insertData(table, worksheetData);
        tables.push(table);
    }
    
    if(control.ok()) {
        loadData(tables);
        control.reset();
    }
}

var createTable = function(tableName, worksheetData) {
    var columns = [];
    var table = {
        name: tableName,
        fkCount: false,
        createSQL: function() {
            var sSQL = 'CREATE TABLE ' + this.name + ' (';
            for(var i=0; i<this.columns.length; i++) {
                var column = this.columns[i];
                sSQL += column.name + ' ' + column.type;
                if(column.name == 'id') sSQL += ' primary key';
                if(i+1 != this.columns.length || this.fkCount > 0) {
                    sSQL += ', ';
                }
            }
            
            var tempFkCount = 0;
            if(this.fkCount > 0) {
                for(var i=0; i<this.columns.length; i++) {
                    var column = this.columns[i];
                    if(column.fk !== '') {
                        tempFkCount++;
                        sSQL += 'FOREIGN KEY(' + column.name + ') REFERENCES ' + column.fk;
                        if(tempFkCount != this.fkCount) {
                            sSQL += ', ';
                        } else {
                            break;
                        }
                    }
                }
            }
            
            sSQL += ');';
            
            return sSQL;
        },
        insertSQL: function() {
            var sSQL = '';
            for(var j=0; j<this.rows.length; j++) {
                var row = this.rows[j];
                var sSQLData = '';
                
                sSQL += 'INSERT INTO ' + this.name + '(';
                for(var i=0; i<this.columns.length; i++) {
                    var col = this.columns[i];
                    sSQL += col.name;
                    
                    if(col.type.toLowerCase() == 'text') {
                        sSQLData += '\'' + escape(row.cells[i]) + '\'';
                    } else {
                        sSQLData += escape(row.cells[i]);
                    }
                    
                    if(i+1 != this.columns.length) {
                        sSQL += ', ';
                        sSQLData += ', ';
                    }
                }
                sSQL += ') VALUES (' + sSQLData + ');';
            }
            
            return sSQL;
        }
    };
    
    for(var i=0; i<worksheetData.feed.entry.length; i++) {
        var item = worksheetData.feed.entry[i];
        if(item.gsx$cell.row == '1') {
            var pos = parseInt(item.gsx$cell.col, 10) - 1;
            
            var column = {
                pos: pos,
                name: item.gsx$cell.$t,
                type: '',
                fk: ''
            };
            
            columns.push(column);
            if(column.name.indexOf('id_') >= 0) {
                table.fkCount++;
            }
        } else if(item.gsx$cell.row == '2') {
            var pos = parseInt(item.gsx$cell.col, 10) - 1;
            var column = columns[pos];
            column.type = item.gsx$cell.$t;
        } else if(item.gsx$cell.row == '3' && table.fkCount > 0) {
            var pos = parseInt(item.gsx$cell.col, 10) - 1;
            var column = columns[pos];
            column.fk = item.gsx$cell.$t;
        } else {
            break;
        }
    }
    
    table.columns = columns;
}

var insertData = function(table, worksheetData) {
    var rows = [];
    
    var startIndex = 2 * table.columns.length;
    if(table.fkCount > 0) {
        startIndex = 3 * table.columns.length;
    }
    
    for(var i=0; i<worksheetData.feed.entry.length; i++) {
        var item = worksheetData.feed.entry[i];
        var col = parseInt(item.gsx$cell.col, 10) - 1;
        var row = parseInt(item.gsx$cell.row, 10) - (startIndex / table.columns.length);
        
        if(col == 0) {
            rows.push({
                row: row,
                cells: []
            });
        }
        
        var line = rows[row];
        line.cells.push(item.gsx$cell.$t);
    }
    
    table.rows = rows;
}

var escape = function(text) {
    var temp = text.replace('\'', '\'\'');
    temp = temp.replace('"', '""');
    return temp;
}

var loadData = function(tables) {
    for(var i=0; i<tables.length; i++) {
        var table = tables[i];
        db.exec(table.createSQL());
        db.exec(table.insertSQL());
    }
}