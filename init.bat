@echo off
setlocal enableextensions enabledelayedexpansion

if "%1" == "" echo "Current options: elasticsearch, nodemon, watch, mongod, mongo, forever"

if "%1" == "" SET /P inputName= "Command > "
if NOT "%1" == "" SET inputName=%1

if "%inputName%" == "elastisearch" goto StartElastisearch
if "%inputName%" == "elasticsearch" goto StartElastisearch
if "%inputName%" == "nodemon" goto StartNodemon
if "%inputName%" == "watch" goto StartGulpWatch
if "%inputName%" == "mongod" goto StartMongod
if "%inputName%" == "mongo" goto StartMongo
if "%inputName%" == "forever" goto StartForever

echo Unknown Start Command...
goto :EndOfFile

:StartElastisearch
	echo Starting Elastisearch...
	cd "C:\elastisearch\bin"
	set "JAVA_HOME=C:\Program Files\Java\jdk1.8.0_101"
	elasticsearch.bat
	goto :EndOfFile

:StartNodemon
	echo Starting Nodemon...
	nodemon server.js -e js --ignore public/
	goto :EndOfFile

:StartGulpWatch
	echo Starting Gulp Watch...
	gulp watch
	goto :EndOfFile

:StartMongod
	echo Starting Mongod...
	mongod
	goto :EndOfFile

:StartMongo
	echo Opening Mongo Shell...
	mongo
	goto :EndOfFile

:StartForever
	echo Starting Forever...
	forever --uid "OEIS" -a start server.js
	goto :EndOfFile

:EndOfFile
endlocal