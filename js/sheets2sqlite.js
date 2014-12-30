var Sheets2sqlite = function(db, workbookId, tablesToProcess) {
    this.db = db;
    this.tablesToProcess = tablesToProcess;
    this.tables = [];
    this.control = {
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
    
    this.url = '//spreadsheets.google.com/feeds/worksheets/' + workbookId + '/public/values?alt=json';
};

Sheets2sqlite.prototype.start = function(done) {
    this.done = done;
    var that = this;
    
    $.ajax({
        url: this.url
    }).done(function(workbookData) {
        for(var i=0; i<workbookData.feed.entry.length; i++) {
            var entry = workbookData.feed.entry[i];
            var item = { name : entry.title.$t, link : entry.link[1].href.replace('https:', '') + '?alt=json' };
            
            that.control.reqs++;
            (function(name, link) {
                $.ajax({
                    url: link
                }).done(function(worksheetData) {
                    that.processWorksheetData(name, worksheetData);
                });
            }) (item.name, item.link);
        }
        that.control.reqOk = true;
    });
};

Sheets2sqlite.prototype.processWorksheetData = function(tableName, worksheetData) {
    this.control.resps++;
    if($.inArray(tableName, this.tablesToProcess) >= 0) {
        var table = this.createTable(tableName, worksheetData);
        this.insertData(table, worksheetData);
        this.tables.push(table);
    }
    
    if(this.control.ok()) {
        this.loadData(this.tables);
        this.done();
        this.control.reset();
    }
};

Sheets2sqlite.prototype.createTable = function(tableName, worksheetData) {
    var columns = [];
    var table = {
        name: tableName,
        fkCount: false,
        validColumns: [],
        regularIndexes: [],
        uniqueIndexes: [],
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
            
            for(var i=0; i<this.regularIndexes.length; i++) {
                var index = this.regularIndexes[i];
                sSQL += this.indexSQL(index, false);
            }
            
            for(var i=0; i<this.uniqueIndexes.length; i++) {
                var index = this.uniqueIndexes[i];
                sSQL += this.indexSQL(index, true);
            }
            
            return sSQL;
        },
        indexSQL: function(index, unique) {
            var temp = 'CREATE ' + (unique ? 'UNIQUE ' : '') + 'INDEX IF NOT EXISTS ';
            temp += index.name;
            temp += ' ON ';
            temp += this.name;
            
            var indexNames = [];
            for(var i=0; i<index.columns.length; i++) {
                indexNames.push(index.columns[i].name);
            }
            
            temp += ' (' + indexNames.join(', ') + ');';
            
            return temp;
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
        },
        getRegularIndex: function(indexName) {
            return this.getIndex(this.regularIndexes, indexName);
        },
        getUniqueIndex: function(indexName) {
            return this.getIndex(this.uniqueIndexes, indexName);
        },
        getIndex: function(indexes, indexName) {
            for(var i=0; i<indexes; i++) {
                var index = indexes[i];
                if(index.name == indexName) {
                    return index;
                }
            }
            return null;
        }
    };
    
    for(var i=0; i<worksheetData.feed.entry.length; i++) {
        var item = worksheetData.feed.entry[i];
        
        if(item.gs$cell.row == '1') {
            var pos = parseInt(item.gs$cell.col, 10) - 1;
            var value = item.gs$cell.$t;
            var name = value.substring(0, value.indexOf('(')).trim();
            var type = value.substring(value.indexOf('(') + 1, value.indexOf(')')).trim();
            
            var column = {
                pos: pos,
                name: name,
                type: type,
                fk: ''
            };
            
            columns.push(column);
            table.validColumns.push(pos);
        } else if(item.gs$cell.row == '2') {
            var pos = parseInt(item.gs$cell.col, 10) - 1;
            var column = columns[table.validColumns.indexOf(pos)];
            var value = item.gs$cell.$t;
            
            if(value !== '') {
                var indexes = value.split(',');
                for(var j=0; j<indexes.length; j++) {
                    var index = indexes[j].trim();
                    if(index.toLowerCase().indexOf('fk_') >= 0) {
                        table.fkCount++;
                        column.fk = index.substring(3, index.length);
                    } else if(index.toLowerCase().indexOf('in_') >= 0) {
                        var regularIndex = table.getRegularIndex(index.toLowerCase());
                        
                        if(regularIndex === null) {
                            regularIndex = {
                                name: index.toLowerCase(),
                                columns: []
                            };
                            
                            table.regularIndexes.push(regularIndex);
                        }
                        
                        regularIndex.columns.push(column);
                    } else if(index.toLowerCase().indexOf('un_') >= 0) {
                        var uniqueIndex = table.getUniqueIndex(index.toLowerCase());
                        
                        if(uniqueIndex === null) {
                            uniqueIndex = {
                                name: index.toLowerCase(),
                                columns: []
                            };
                            
                            table.uniqueIndexes.push(uniqueIndex);
                        }
                        
                        uniqueIndex.columns.push(column);
                    }
                }
            }
        } else {
            break;
        }
    }
    
    table.columns = columns;
    
    return table;
};

Sheets2sqlite.prototype.insertData = function(table, worksheetData) {
    var rows = [];
    
    var linhaInicial = 3;
    
    for(var i=0; i<worksheetData.feed.entry.length; i++) {
        var item = worksheetData.feed.entry[i];
        var col = parseInt(item.gs$cell.col, 10) - 1;
        var row = parseInt(item.gs$cell.row, 10) - linhaInicial;
        
        if(row < 0) {
            continue;
        }
        
        if(col === 0) {
            rows.push({
                row: row,
                cells: []
            });
        }
        
        if(table.validColumns.indexOf(col + 1) >= 0) {
            var line = rows[row];
            line.cells.push(item.gs$cell.$t);
        }
    }
    
    table.rows = rows;
};

Sheets2sqlite.prototype.loadData = function(tables) {
    for(var i=0; i<tables.length; i++) {
        var table = tables[i];
        
        this.db.exec(table.createSQL());
        this.db.exec(table.insertSQL());
    }
};

var escape = function(text) {
    var temp = text.replace('\'', '\'\'');
    temp = temp.replace('"', '""');
    return temp;
};

var tableCreate = function () {
    function valconcat(vals, tagName) {
        if (vals.length === 0) return '';
        var open = '<'+tagName+'>', close='</'+tagName+'>';
        return open + vals.join(close + open) + close;
    }
    
    return function (columns, values) {
        var tbl  = document.createElement('table');
        var html = '<thead>' + valconcat(columns, 'th') + '</thead>';
        var rows = values.map(function(v){ return valconcat(v, 'td'); });
        html += '<tbody>' + valconcat(rows, 'tr') + '</tbody>';
        tbl.innerHTML = html;
        return tbl;
    };
};