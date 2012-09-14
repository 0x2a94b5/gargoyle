GARGOYLE_VERSION:=1.5.X (Built $(shell echo "`date -u +%Y%m%d-%H%M` git@`git log -1 --pretty=format:%h`"))
V=99
FULL_BUILD=false
CUSTOM_TEMPLATE=ar71xx
JS_COMPRESS=true


ALL: all
all:
	( \
		targets=`ls targets | sed 's/custom//g' ` ;\
		for t in $$targets ; do \
			if [ ! -d "$$t-src" ] || [ "$(FULL_BUILD)" = "1" -o "$(FULL_BUILD)" = "true" -o "$(FULL_BUILD)" = "TRUE" ] ; then \
				bash full-build.sh "$$t" "$(GARGOYLE_VERSION)" "$(V)" "" "$(JS_COMPRESS)" "";\
			else \
				bash rebuild.sh "$$t" "$(GARGOYLE_VERSION)" "$(V)" "$(JS_COMPRESS)" "";\
			fi ;\
		done ;\
	)


%:
	( \
		target=`echo $@  | sed 's/\..*$$//'` ; \
		profile=`echo $@ | sed 's/^.*\.//'`  ; \
		have_profile=`echo $@ | grep "\."`  ; \
		if [ -z "$$have_profile" ] ; then profile="" ; fi ; \
		if [ ! -d "targets/$${target}" ] ; then echo "ERROR: Specified Target Does Not Exist" ; exit ; fi ; \
		if [ -n "$$profile" ] && [ ! -d "targets/$${target}/profiles/$${profile}" ] ; then echo "ERROR: Specified Target Profile Does Not Exist" ; exit ; fi ; \
		if [ ! -d "$${target}-src" ] || [ "$(FULL_BUILD)" = "1" -o "$(FULL_BUILD)" = "true" -o "$(FULL_BUILD)" = "TRUE" ] ; then \
			bash full-build.sh "$$target" "$(GARGOYLE_VERSION)" "$(V)" "$(CUSTOM_TEMPLATE)" "$(JS_COMPRESS)" "$$profile" ; \
		else \
			bash rebuild.sh "$$target" "$(GARGOYLE_VERSION)" "$(V)" "$(JS_COMPRESS)" "$$profile"; \
		fi ; \
	)

cleanup:
	find . -name ".svn" | xargs rm -rf
	find . -name "*~" | xargs rm -rf
	find . -name ".*sw*" | xargs rm -rf

# If you run this, you will need to start all over with compiling.
distclean: cleanup
	rm -rf ./*-src
	rm -rf ./built
	rm -rf ./images
	rm -rf ./downloaded
