const exec = require('child_process').exec;

exec("ant -buildfile build_flash.xml -Dbuild=build/classes wrapper", function(err) {
  exec("ant -buildfile build_flash.xml -Dbuild=build/classes build-CC-osmf", function(err) {
    exec("ant -buildfile build_flash.xml -Dbuild=build/classes build-osmf", function(err) {
      if (err) console.log("Error occured in building osmf plugin : " + err);
      exec("ant -buildfile build_flash.xml -Dbuild=build/classes clean-osmf", function(err) {
        if (err) return console.log(err);
      });
    });
  });
});

exec("ant -buildfile build_flash.xml -Dbuild=build/classes wrapper", function(err) {
  exec("ant -buildfile build_flash.xml -Dbuild=build/classes build-CC-akamai", function(err) {
    exec("ant -buildfile build_flash.xml -Dbuild=build/classes build-akamai", function(err) {
      if (err) console.log("Error occured in building akamai plugin : " + err);
      exec("ant -buildfile build_flash.xml -Dbuild=build/classes clean-akamai", function(err) {
        if (err) return console.log(err);
      });
    });
  });
});