import React, { useRef } from 'react';
import "./search.css";

const Search = ({setSearch, doSearch}) => {

  const searchText = useRef("");

  return (
    <div className="searchContainer">
        <input
            className="searchBox"
            type="text"
            placeholder="Search"
            // onChange={({currentTarget:input}) => setSearch(input.value)}
            ref = {searchText}
        />
        <button className="searchButton" onClick={()=>doSearch(searchText.current.value)}>Search</button>
    </div>

    )
}

export default Search;