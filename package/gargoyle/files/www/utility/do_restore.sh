#!/usr/bin/haserl --upload-limit=5120 --upload-dir=/tmp/
<?
	# This program is copyright � 2008 Eric Bishop and is distributed under the terms of the GNU GPL 
	# version 2.0 with a special clarification/exception that permits adapting the program to 
	# configure proprietary "back end" software provided that all modifications to the web interface
	# itself remain covered by the GPL. 
	# See http://gargoyle-router.com/faq.html#qfoss for more information



	echo "Content-type: text/html"
	echo ""

	echo '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">'
	echo '<html xmlns="http://www.w3.org/1999/xhtml">'
	echo '<body>'

	if [ -e /tmp/restore ] ; then
		rm -rf /tmp/restore
	fi
	mkdir -p /tmp/restore	
	mv $FORM_restore_file /tmp/restore/restore.tar.gz
	cd /tmp/restore
	
	# bwmon writes everything when it shuts down
	# we therefore need to shut it down, otherwise
	# all the new data gets over-written when we restart it
	if [ -e /etc/init.d/bwmon_gargoyle ] ; then
		/etc/init.d/bwmon_gargoyle stop
	fi
	
	tar xzf restore.tar.gz -C / 2>error
	error=$(cat error)

	cd /tmp
	if [ -e /tmp/restore ] ; then
		rm -rf /tmp/restore
	fi

	new_ip=$(uci get network.lan.ipaddr)

	if [ -n "$error" ] ; then
		echo "<script type=\"text/javascript\">top.restoreFailed();</script>"
	else
		echo "<script type=\"text/javascript\">top.restoreSuccessful(\"$new_ip\");</script>"
	fi

	echo "</body></html>"
?>
