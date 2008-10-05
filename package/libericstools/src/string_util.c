/*
 *  Copyright © 2008 by Eric Bishop <eric@gargoyle-router.com>
 *
 *  NOTE THAT UNLIKE OTHER PARTS OF GARGOYLE THIS LIBRARY FALLS UNDER THE LGPL, NOT THE GPL
 * 
 *  This file is free software: you may copy, redistribute and/or modify it
 *  under the terms of the GNU Lesser General Public License as published by the
 *  Free Software Foundation, either version 2 of the License, or (at your
 *  option) any later version.
 *
 *  This file is distributed in the hope that it will be useful, but
 *  WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 *  Lesser General Public License for more details.
 *
 *  You should have received a copy of the GNU Lesser General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

#include "erics_tools.h"

char* replace_prefix(char* original, char* old_prefix, char* new_prefix)
{
	char* replaced = NULL;
	if(original != NULL && old_prefix != NULL && new_prefix != NULL && strstr(original, old_prefix) == original)
	{
		int old_prefix_length = strlen(old_prefix);
		int new_prefix_length = strlen(new_prefix);
		int remainder_length = strlen(original) - old_prefix_length;
		int new_length = new_prefix_length + remainder_length;
		//printf("%d %d %d %d\n", old_prefix_length, new_prefix_length, remainder_length, new_length);
		
		replaced = malloc(new_length+1);
		memcpy(replaced, new_prefix, new_prefix_length);
		memcpy(replaced+new_prefix_length, original+old_prefix_length, remainder_length);
		replaced[new_prefix_length+remainder_length] = '\0';
	}
	return replaced;
}

char* trim_flanking_whitespace(char* str)
{
	int new_start = 0;;
	int new_length = 0;

	char whitespace[5];
	int num_whitespace_chars = 4;
	whitespace[0] = ' ';
	whitespace[1] = '\t';
	whitespace[2] = '\n';
	whitespace[3] = '\r';
	
	int index = 0;
	int is_whitespace = 1;
	int test;
	while( (test = str[index]) != '\0' && is_whitespace == 1)
	{
		int whitespace_index;
		is_whitespace = 0;
		for(whitespace_index = 0; whitespace_index < num_whitespace_chars && is_whitespace == 0; whitespace_index++)
		{
			is_whitespace = test == whitespace[whitespace_index] ? 1 : 0;
		}
		index = is_whitespace == 1 ? index+1 : index;
	}
	new_start = index;


	index = strlen(str) - 1;
	is_whitespace = 1;
	while( index >= new_start && is_whitespace == 1)
	{
		int whitespace_index;
		is_whitespace = 0;
		for(whitespace_index = 0; whitespace_index < num_whitespace_chars && is_whitespace == 0; whitespace_index++)
		{
			is_whitespace = str[index] == whitespace[whitespace_index] ? 1 : 0;
		}
		index = is_whitespace == 1 ? index-1 : index;
	}
	new_length = str[new_start] == '\0' ? 0 : index + 1 - new_start;
	

	if(new_start > 0)
	{
		for(index = 0; index < new_length; index++)
		{
			str[index] = str[index+new_start];
		}
	}
	str[new_length] = 0;
	return str;
}

//note: return value is dynamically allocated, need to free
dyn_read_t dynamic_read(FILE* open_file, char* terminators, int num_terminators)
{
	fpos_t start_pos;
	fgetpos(open_file, &start_pos);
	int size_to_read = 0;
	int terminator_found = 0;
	int terminator;
	while(terminator_found == 0)
	{
		int nextch = fgetc(open_file);
		int terminator_index = 0;
		for(terminator_index = 0; terminator_index < num_terminators && terminator_found == 0; terminator_index++)
		{
			terminator_found = nextch == terminators[terminator_index] ? 1 : 0;
			terminator = nextch;
		}
		terminator_found = nextch == EOF ? 1 : terminator_found;
		terminator = nextch == EOF ? EOF : nextch;
		if(terminator_found == 0)
		{
			size_to_read++;
		}
	}

	dyn_read_t ret_value;
	ret_value.terminator = terminator;
	ret_value.str = NULL;
	if(size_to_read > 0)
	{
		fsetpos(open_file, &start_pos);
		char *str = (char*)malloc(size_to_read+1);
		int i = 0;
		for(i=0; i<size_to_read; i++)
		{
			str[i] = (char)fgetc(open_file);
		}
		str[size_to_read] = NULL;
		ret_value.str = str;
	}
	fgetc(open_file); //read the separator


	return ret_value;
}

char* read_entire_file(FILE* in, int read_block_size)
{
	int max_read_size = read_block_size;
	char* read_string = (char*)malloc(max_read_size+1);
	int bytes_read = 0;
	int end_found = 0;
	while(end_found == 0)
	{
		int nextch = '?';
		while(nextch != EOF && bytes_read < max_read_size)
		{
			nextch = fgetc(in);
			if(nextch != EOF)
			{
				read_string[bytes_read] = nextch;
				bytes_read++;
			}
		}
		read_string[bytes_read] = '\0';
		end_found = (nextch == EOF) ? 1 : 0;
		if(end_found == 0)
		{
			max_read_size = max_read_size + read_block_size;
			char *new_str = (char*)malloc(max_read_size+1);
			strcpy(new_str, read_string);
			free(read_string);
			read_string = new_str;
		}
	}
	return read_string;
}



int safe_strcmp(const char* str1, const char* str2)
{
	if(str1 == NULL && str2 == NULL)
	{
		return 0;
	}
	else if(str1 == NULL && str2 != NULL)
	{
		return 1;
	}
	else if(str1 != NULL && str2 == NULL)
	{
		return -1;
	}
	return strcmp(str1, str2);
}


// line is the line to be parsed -- it is not modified in any way
// max_pieces indicates number of pieces to return, if negative this is determined dynamically
// include_remainder_at_max indicates whether the last piece, when max pieces are reached, 
// 	should be what it would normally be (0) or the entire remainder of the line (1)
// 	if max_pieces < 0 this parameter is ignored
//
//
//returns all non-separator pieces in a line
// result is dynamically allocated, MUST be freed after call-- even if 
// line is empty (you still get a valid char** pointer to to a NULL char*)
char** split_on_separators(char* line, char* separators, int num_separators, int max_pieces, int include_remainder_at_max)
{
	char** split;

	if(line != NULL)
	{
		if(max_pieces < 0)
		{
			//count number of separator characters in line -- this count + 1 is an upperbound on number of pieces
			int separator_count = 0;
			int line_index;
			for(line_index = 0; line[line_index] != '\0'; line_index++)
			{
				int sep_index;
				int found = 0;
				for(sep_index =0; found == 0 && sep_index < num_separators; sep_index++)
				{
					found = separators[sep_index] == line[line_index] ? 1 : 0;
				}
				separator_count = separator_count+ found;
			}
			max_pieces = separator_count + 1;
		}
		split = (char**)malloc((1+max_pieces)*sizeof(char*));
		int split_index = 0;
		split[split_index] = NULL;


		char* dup_line = strdup(line);
		char* start = dup_line;
		int non_separator_found = 0;
		while(non_separator_found == 0)
		{
			int matches = 0;
			int sep_index;
			for(sep_index =0; sep_index < num_separators; sep_index++)
			{
				matches = matches == 1 || separators[sep_index] == start[0] ? 1 : 0;
			}
			non_separator_found = matches==0 || start[0] == '\0' ? 1 : 0;
			if(non_separator_found == 0)
			{
				start++;
			}
		}

		while(start[0] != '\0' && split_index < max_pieces)
		{
			//find first separator index
			int first_separator_index = 0;
			int separator_found = 0;
			while(	separator_found == 0 )
			{
				int sep_index;
				for(sep_index =0; separator_found == 0 && sep_index < num_separators; sep_index++)
				{
					separator_found = separators[sep_index] == start[first_separator_index] || start[first_separator_index] == '\0' ? 1 : 0;
				}
				if(separator_found == 0)
				{
					first_separator_index++;
				}
			}
			
			//copy next piece to split array
			if(first_separator_index > 0)
			{
				char* next_piece = NULL;
				if(split_index +1 < max_pieces || include_remainder_at_max <= 0)
				{
					next_piece = (char*)malloc((first_separator_index+1)*sizeof(char));
					memcpy(next_piece, start, first_separator_index);
					next_piece[first_separator_index] = '\0';
				}
				else
				{
					next_piece = strdup(start);
				}
				split[split_index] = next_piece;
				split[split_index+1] = NULL;
				split_index++;
			}


			//find next non-separator index, indicating start of next piece
			start = start+ first_separator_index;
			non_separator_found = 0;
			while(non_separator_found == 0)
			{
				int matches = 0;
				int sep_index;
				for(sep_index =0; sep_index < num_separators; sep_index++)
				{
					matches = matches == 1 || separators[sep_index] == start[0] ? 1 : 0;
				}
				non_separator_found = matches==0 || start[0] == '\0' ? 1 : 0;
				if(non_separator_found == 0)
				{
					start++;
				}
			}
		}
		free(dup_line);
	}
	else
	{
		split = (char**)malloc((1)*sizeof(char*));
		split[0] = NULL;
	}
	return split;
}

void to_lowercase(char* str)
{
	int i;
	for(i = 0; str[i] != '\0'; i++)
	{
		str[i] = tolower(str[i]);
	}
}
void to_uppercase(char* str)
{
	int i;
	for(i = 0; str[i] != '\0'; i++)
	{
		str[i] = toupper(str[i]);
	}
}

char* dynamic_strcat(int num_strs, ...)
{
	
	va_list strs;
	int new_length = 0;
	
	va_start(strs, num_strs);
	int i;
	for(i=0; i < num_strs; i++)
	{
		char* next_arg = va_arg(strs, char*);
		if(next_arg != NULL)
		{
			new_length = new_length + strlen(next_arg);
		}
	}
	va_end(strs);
	
	char* new_str = malloc((1+new_length)*sizeof(char));
	va_start(strs, num_strs);
	int next_start = 0;
	for(i=0; i < num_strs; i++)
	{
		char* next_arg = va_arg(strs, char*);
		if(next_arg != NULL)
		{
			int next_length = strlen(next_arg);
			memcpy(new_str+next_start,next_arg, next_length);
			next_start = next_start+next_length;
		}
	}
	new_str[next_start] = '\0';
	
	return new_str;
}

