const Template = ({ comic }) => {
  //    const comic = props.data;
  //    console.log(comic)

  return (
    <>
      <div>
        <img src={comic.coverImage.url} alt="coverImage" id="coverImage"/>
      </div>
      <h5 id="comicName">{comic.comicName}</h5>
      <p>{comic.chapterNumber}</p>
      <p>{comic.genre}</p>
    </>
  );
};

export default Template;
